import random
import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_connection
from app.websocket import manager


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="LiveGrid API",
    description="Real-time collaborative territory grid",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
         "https://live-grid-virid.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# CONSTANTS
# ============================================================

GRID_SIZE = 20
TOTAL_CELLS = GRID_SIZE * GRID_SIZE


# ============================================================
# ANONYMOUS USER GENERATOR
# ============================================================

NAME_PREFIXES = [
    "Pixel",
    "Grid",
    "Code",
    "Data",
    "Web",
    "Cloud",
    "Byte",
    "Dev",
    "Tech",
    "Logic",
    "Neon",
    "Cyber",
]

NAME_SUFFIXES = [
    "Fox",
    "Ninja",
    "Master",
    "Wizard",
    "Runner",
    "Pilot",
    "Coder",
    "Builder",
    "Hunter",
    "Explorer",
    "Spark",
    "Rider",
]

COLORS = [
    "#8B5CF6",
    "#06B6D4",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#EC4899",
    "#3B82F6",
    "#14B8A6",
    "#F97316",
    "#A855F7",
]


def generate_username():
    prefix = random.choice(NAME_PREFIXES)
    suffix = random.choice(NAME_SUFFIXES)
    number = random.randint(10, 99)

    return f"{prefix}{suffix}{number}"


def generate_color():
    return random.choice(COLORS)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "LiveGrid API is running 🚀",
        "version": "1.0.0",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "livegrid-api",
    }


# ============================================================
# DATABASE TEST
# ============================================================

@app.get("/db-test")
def database_test():

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    "SELECT COUNT(*) FROM cells"
                )

                result = cursor.fetchone()

        return {
            "database": "connected",
            "cell_count": result[0],
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(error)}",
        )


# ============================================================
# CREATE ANONYMOUS USER
# ============================================================

@app.post("/users")
def create_user():

    user_id = str(uuid.uuid4())
    username = generate_username()
    color = generate_color()

    try:

        with get_connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    INSERT INTO users (
                        id,
                        username,
                        color
                    )
                    VALUES (
                        %s,
                        %s,
                        %s
                    )
                    RETURNING
                        id,
                        username,
                        color,
                        created_at
                    """,
                    (
                        user_id,
                        username,
                        color,
                    ),
                )

                result = cursor.fetchone()

            conn.commit()

        return {
            "success": True,
            "user": {
                "id": str(result[0]),
                "username": result[1],
                "color": result[2],
                "created_at": (
                    result[3].isoformat()
                    if result[3]
                    else None
                ),
            },
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to create user: {str(error)}",
        )


# ============================================================
# GET USER
# ============================================================

@app.get("/users/{user_id}")
def get_user(user_id: str):

    try:

        with get_connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        id,
                        username,
                        color,
                        created_at
                    FROM users
                    WHERE id = %s
                    """,
                    (user_id,),
                )

                result = cursor.fetchone()

        if result is None:

            raise HTTPException(
                status_code=404,
                detail="User not found",
            )

        return {
            "id": str(result[0]),
            "username": result[1],
            "color": result[2],
            "created_at": (
                result[3].isoformat()
                if result[3]
                else None
            ),
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to get user: {str(error)}",
        )


# ============================================================
# GRID
# ============================================================

@app.get("/grid")
def get_grid():

    try:

        with get_connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        c.id,
                        c.row_index,
                        c.col_index,
                        c.owner_id,
                        u.username,
                        u.color,
                        c.claimed_at
                    FROM cells c
                    LEFT JOIN users u
                        ON c.owner_id = u.id
                    ORDER BY c.id
                    """
                )

                rows = cursor.fetchall()

        cells = []

        for row in rows:

            cells.append({
                "id": row[0],
                "row": row[1],
                "col": row[2],
                "owner_id": (
                    str(row[3])
                    if row[3]
                    else None
                ),
                "owner_name": row[4],
                "color": row[5],
                "claimed_at": (
                    row[6].isoformat()
                    if row[6]
                    else None
                ),
            })

        return {
            "size": GRID_SIZE,
            "total_cells": len(cells),
            "cells": cells,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to load grid: {str(error)}",
        )


# ============================================================
# CLAIM CELL
# ============================================================

@app.post("/grid/claim")
async def claim_cell(
    row: int,
    col: int,
    user_id: str,
):

    # --------------------------------------------------------
    # Validate coordinates
    # --------------------------------------------------------

    if row < 0 or row >= GRID_SIZE:

        raise HTTPException(
            status_code=400,
            detail="Invalid row",
        )

    if col < 0 or col >= GRID_SIZE:

        raise HTTPException(
            status_code=400,
            detail="Invalid column",
        )


    try:

        with get_connection() as conn:

            with conn.cursor() as cursor:

                # ------------------------------------------------
                # Validate user
                # ------------------------------------------------

                cursor.execute(
                    """
                    SELECT
                        id,
                        username,
                        color
                    FROM users
                    WHERE id = %s
                    """,
                    (user_id,),
                )

                user = cursor.fetchone()

                if user is None:

                    raise HTTPException(
                        status_code=404,
                        detail="User not found",
                    )

                actual_user_id = user[0]
                username = user[1]
                color = user[2]


                # ------------------------------------------------
                # ATOMIC CLAIM
                # ------------------------------------------------
                #
                # Only an unclaimed cell can be updated.
                #
                # This protects against two users attempting
                # to claim the same cell simultaneously.
                # ------------------------------------------------

                cursor.execute(
                    """
                    UPDATE cells
                    SET
                        owner_id = %s,
                        claimed_at = CURRENT_TIMESTAMP
                    WHERE
                        row_index = %s
                        AND col_index = %s
                        AND owner_id IS NULL
                    RETURNING
                        id,
                        row_index,
                        col_index,
                        owner_id,
                        claimed_at
                    """,
                    (
                        actual_user_id,
                        row,
                        col,
                    ),
                )

                result = cursor.fetchone()


                # ------------------------------------------------
                # Claim failed
                # ------------------------------------------------

                if result is None:

                    cursor.execute(
                        """
                        SELECT
                            id,
                            owner_id
                        FROM cells
                        WHERE
                            row_index = %s
                            AND col_index = %s
                        """,
                        (
                            row,
                            col,
                        ),
                    )

                    existing_cell = cursor.fetchone()


                    if existing_cell is None:

                        conn.rollback()

                        raise HTTPException(
                            status_code=404,
                            detail="Cell not found",
                        )


                    conn.rollback()

                    raise HTTPException(
                        status_code=409,
                        detail="Cell is already claimed",
                    )


                # ------------------------------------------------
                # Extract result
                # ------------------------------------------------

                cell_id = result[0]
                cell_row = result[1]
                cell_col = result[2]
                owner_id = result[3]
                claimed_at = result[4]


                # ------------------------------------------------
                # Claim history
                # ------------------------------------------------

                cursor.execute(
                    """
                    INSERT INTO claims (
                        cell_id,
                        user_id
                    )
                    VALUES (
                        %s,
                        %s
                    )
                    """,
                    (
                        cell_id,
                        actual_user_id,
                    ),
                )


            # ----------------------------------------------------
            # Commit transaction
            # ----------------------------------------------------

            conn.commit()


        # --------------------------------------------------------
        # Authoritative response
        # --------------------------------------------------------

        cell = {
            "id": cell_id,
            "row": cell_row,
            "col": cell_col,
            "owner_id": str(owner_id),
            "owner_name": username,
            "color": color,
            "claimed_at": (
                claimed_at.isoformat()
                if claimed_at
                else None
            ),
        }


        # --------------------------------------------------------
        # Broadcast
        # --------------------------------------------------------

        await manager.broadcast({
            "type": "cell_claimed",
            "cell": cell,
        })


        return {
            "success": True,
            "cell": cell,
        }


    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to claim cell: {str(error)}",
        )


# ============================================================
# LEADERBOARD
# ============================================================

@app.get("/leaderboard")
def get_leaderboard():

    try:

        with get_connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        u.id,
                        u.username,
                        u.color,
                        COUNT(c.id) AS cells_claimed
                    FROM users u
                    LEFT JOIN cells c
                        ON c.owner_id = u.id
                    GROUP BY
                        u.id,
                        u.username,
                        u.color
                    HAVING COUNT(c.id) > 0
                    ORDER BY
                        cells_claimed DESC,
                        u.username ASC
                    LIMIT 10
                    """
                )

                rows = cursor.fetchall()

        leaderboard = []

        for index, row in enumerate(rows):

            leaderboard.append({
                "rank": index + 1,
                "user_id": str(row[0]),
                "username": row[1],
                "color": row[2],
                "cells_claimed": row[3],
            })

        return {
            "leaderboard": leaderboard,
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to load leaderboard: {str(error)}",
        )


# ============================================================
# GLOBAL STATS
# ============================================================

@app.get("/stats")
def get_stats():

    try:

        with get_connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS total_cells,
                        COUNT(owner_id) AS claimed_cells
                    FROM cells
                    """
                )

                grid_result = cursor.fetchone()


                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM users
                    """
                )

                user_result = cursor.fetchone()


                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM claims
                    """
                )

                claim_result = cursor.fetchone()


        total_cells = grid_result[0]
        claimed_cells = grid_result[1]

        available_cells = (
            total_cells - claimed_cells
        )

        percentage = (
            round(
                (claimed_cells / total_cells) * 100,
                1,
            )
            if total_cells
            else 0
        )

        return {
            "total_cells": total_cells,
            "claimed_cells": claimed_cells,
            "available_cells": available_cells,
            "claim_percentage": percentage,
            "total_users": user_result[0],
            "total_claims": claim_result[0],
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to load stats: {str(error)}",
        )


# ============================================================
# WEBSOCKET
# ============================================================

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
):

    await manager.connect(websocket)

    try:

        # ----------------------------------------------------
        # Load current state from PostgreSQL
        # ----------------------------------------------------

        with get_connection() as conn:

            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT
                        c.id,
                        c.row_index,
                        c.col_index,
                        c.owner_id,
                        u.username,
                        u.color,
                        c.claimed_at
                    FROM cells c
                    LEFT JOIN users u
                        ON c.owner_id = u.id
                    ORDER BY c.id
                    """
                )

                rows = cursor.fetchall()


        cells = []

        for row in rows:

            cells.append({
                "id": row[0],
                "row": row[1],
                "col": row[2],
                "owner_id": (
                    str(row[3])
                    if row[3]
                    else None
                ),
                "owner_name": row[4],
                "color": row[5],
                "claimed_at": (
                    row[6].isoformat()
                    if row[6]
                    else None
                ),
            })


        # ----------------------------------------------------
        # Initial state
        # ----------------------------------------------------

        await websocket.send_json({
            "type": "grid_state",
            "cells": cells,
        })


        # ----------------------------------------------------
        # Keep connection alive
        # ----------------------------------------------------

        while True:

            await websocket.receive_text()


    except WebSocketDisconnect:

        manager.disconnect(websocket)

    except Exception as error:

        print(
            f"WebSocket error: {error}"
        )

        manager.disconnect(websocket)