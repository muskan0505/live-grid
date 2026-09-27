GRID_SIZE = 20


def create_grid():
    cells = []

    cell_id = 1

    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            cells.append({
                "id": cell_id,
                "row": row,
                "col": col,
                "owner_id": None,
                "owner_name": None,
                "color": None,
            })

            cell_id += 1

    return cells


grid = create_grid()