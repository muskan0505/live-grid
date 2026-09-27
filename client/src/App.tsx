import {
  useEffect,
  useMemo,
  useState,
} from "react";


interface User {
  id: string;
  username: string;
  color: string;
  created_at?: string | null;
}


interface Cell {
  id: number;
  row: number;
  col: number;
  owner_id: string | null;
  owner_name: string | null;
  color: string | null;
  claimed_at?: string | null;
}


interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  color: string;
  cells_claimed: number;
}


interface Stats {
  total_cells: number;
  claimed_cells: number;
  available_cells: number;
  claim_percentage: number;
  total_users: number;
  total_claims: number;
}


type Theme = "dark" | "light";


// const API_URL =
//   "http://127.0.0.1:8000";

// const WS_URL =
//   "ws://127.0.0.1:8000/ws";
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";


const WS_URL =
  import.meta.env.VITE_WS_URL ||
  "ws://127.0.0.1:8000/ws";


const ACCENT_COLORS = [
  "#8B5CF6",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#3B82F6",
];


function App() {

  const [user, setUser] =
    useState<User | null>(null);

  const [cells, setCells] =
    useState<Cell[]>([]);

  const [leaderboard, setLeaderboard] =
    useState<LeaderboardEntry[]>([]);

  const [stats, setStats] =
    useState<Stats | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [claimingId, setClaimingId] =
    useState<number | null>(null);

  const [connected, setConnected] =
    useState(false);

  const [theme, setTheme] =
    useState<Theme>(() => {

      const saved =
        localStorage.getItem(
          "livegrid_theme"
        );

      return saved === "light"
        ? "light"
        : "dark";
    });


  const [accent, setAccent] =
    useState(() => {

      return (
        localStorage.getItem(
          "livegrid_accent"
        ) ||
        "#8B5CF6"
      );
    });


  const [showThemePanel, setShowThemePanel] =
    useState(false);


  // ==========================================================
  // APPLY THEME
  // ==========================================================

  useEffect(() => {

    document.documentElement.dataset.theme =
      theme;

    document.documentElement.style.setProperty(
      "--accent",
      accent
    );

    localStorage.setItem(
      "livegrid_theme",
      theme
    );

    localStorage.setItem(
      "livegrid_accent",
      accent
    );

  }, [theme, accent]);


  // ==========================================================
  // CREATE / RESTORE USER
  // ==========================================================

  useEffect(() => {

    const initializeUser =
      async () => {

        try {

          const savedUserId =
            localStorage.getItem(
              "livegrid_user_id"
            );


          if (savedUserId) {

            const response =
              await fetch(
                `${API_URL}/users/${savedUserId}`
              );


            if (response.ok) {

              const existingUser =
                await response.json();

              setUser(existingUser);

              return;
            }


            localStorage.removeItem(
              "livegrid_user_id"
            );
          }


          const response =
            await fetch(
              `${API_URL}/users`,
              {
                method: "POST",
              }
            );


          if (!response.ok) {

            throw new Error(
              "Unable to create user"
            );
          }


          const data =
            await response.json();


          const newUser =
            data.user;


          localStorage.setItem(
            "livegrid_user_id",
            newUser.id
          );


          setUser(newUser);

        } catch (err) {

          console.error(err);

          setError(
            "Unable to create your LiveGrid identity."
          );

          setLoading(false);
        }
      };


    initializeUser();

  }, []);


  // ==========================================================
  // LOAD LEADERBOARD
  // ==========================================================

  const loadLeaderboard =
    async () => {

      try {

        const response =
          await fetch(
            `${API_URL}/leaderboard`
          );


        if (!response.ok) {
          throw new Error(
            "Failed to load leaderboard"
          );
        }


        const data =
          await response.json();


        setLeaderboard(
          data.leaderboard
        );

      } catch (err) {

        console.error(
          "Leaderboard error:",
          err
        );
      }
    };


  // ==========================================================
  // LOAD STATS
  // ==========================================================

  const loadStats =
    async () => {

      try {

        const response =
          await fetch(
            `${API_URL}/stats`
          );


        if (!response.ok) {
          throw new Error(
            "Failed to load stats"
          );
        }


        const data =
          await response.json();


        setStats(data);

      } catch (err) {

        console.error(
          "Stats error:",
          err
        );
      }
    };


  // ==========================================================
  // INITIAL DATA
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }

    loadLeaderboard();
    loadStats();

  }, [user]);


  // ==========================================================
  // WEBSOCKET
  // ==========================================================

  useEffect(() => {

    if (!user) {
      return;
    }


    const socket =
      new WebSocket(WS_URL);


    socket.onopen = () => {

      setConnected(true);

      console.log(
        "LiveGrid WebSocket connected"
      );
    };


    socket.onmessage =
      (event) => {

        const message =
          JSON.parse(event.data);


        if (
          message.type ===
          "grid_state"
        ) {

          setCells(
            message.cells
          );

          setLoading(false);
        }


        if (
          message.type ===
          "cell_claimed"
        ) {

          setCells(
            previous =>
              previous.map(
                cell =>
                  cell.id ===
                  message.cell.id
                    ? message.cell
                    : cell
              )
          );


          loadLeaderboard();
          loadStats();
        }
      };


    socket.onclose = () => {

      setConnected(false);

    };


    socket.onerror = () => {

      setConnected(false);

      setError(
        "Realtime connection unavailable."
      );

      setLoading(false);
    };


    return () => {

      socket.close();

    };

  }, [user]);


  // ==========================================================
  // CLAIM
  // ==========================================================

  const handleCellClick =
    async (
      cell: Cell
    ) => {

      if (!user) {
        return;
      }


      if (
        cell.owner_id !== null
      ) {
        return;
      }


      if (
        claimingId !== null
      ) {
        return;
      }


      setClaimingId(cell.id);
      setError("");


      try {

        const response =
          await fetch(
            `${API_URL}/grid/claim?row=${cell.row}&col=${cell.col}&user_id=${user.id}`,
            {
              method: "POST",
            }
          );


        if (
          response.status === 409
        ) {

          setError(
            "Someone claimed that territory first."
          );

          return;
        }


        if (
          response.status === 404
        ) {

          setError(
            "Your session has expired. Refresh the page."
          );

          return;
        }


        if (!response.ok) {

          throw new Error(
            "Claim failed"
          );
        }

      } catch (err) {

        console.error(err);

        setError(
          "Unable to claim territory."
        );

      } finally {

        setClaimingId(null);
      }
    };


  // ==========================================================
  // DERIVED
  // ==========================================================

  const myClaimedCount =
    useMemo(
      () =>
        cells.filter(
          cell =>
            cell.owner_id ===
            user?.id
        ).length,
      [cells, user]
    );


  const topUser =
    leaderboard.length
      ? leaderboard[0]
      : null;


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {

    return (
      <div className="loading-screen">

        <div className="loader-logo">
          LG
        </div>

        <h1>
          LiveGrid
        </h1>

        <p>
          Connecting to the territory network...
        </p>

      </div>
    );
  }


  return (

    <div className="app-shell">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="navbar">

        <div className="brand">

          <div className="brand-icon">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div>

            <strong>
              LiveGrid
            </strong>

            <small>
              REALTIME TERRITORY
            </small>

          </div>

        </div>


        <div className="nav-actions">

          <div
            className={
              connected
                ? "connection online"
                : "connection"
            }
          >

            <span />

            {connected
              ? "LIVE"
              : "OFFLINE"}

          </div>


          <button
            className="theme-button"
            type="button"
            onClick={() =>
              setShowThemePanel(
                previous => !previous
              )
            }
            aria-label="Customize theme"
          >

            {theme === "dark"
              ? "☀"
              : "☾"}

          </button>

        </div>

      </header>


      {/* =====================================================
          THEME PANEL
      ===================================================== */}

      {showThemePanel && (

        <div className="theme-panel">

          <div className="theme-panel-title">
            Appearance
          </div>


          <div className="theme-options">

            <button
              type="button"
              className={
                theme === "dark"
                  ? "theme-option active"
                  : "theme-option"
              }
              onClick={() =>
                setTheme("dark")
              }
            >
              <span>☾</span>
              Dark
            </button>


            <button
              type="button"
              className={
                theme === "light"
                  ? "theme-option active"
                  : "theme-option"
              }
              onClick={() =>
                setTheme("light")
              }
            >
              <span>☀</span>
              Light
            </button>

          </div>


          <div className="accent-title">
            Accent
          </div>


          <div className="accent-picker">

            {ACCENT_COLORS.map(
              color => (

                <button
                  key={color}
                  type="button"
                  className={
                    accent === color
                      ? "accent active"
                      : "accent"
                  }
                  style={{
                    background:
                      color,
                  }}
                  onClick={() =>
                    setAccent(color)
                  }
                  aria-label={`Use ${color} accent`}
                />

              )
            )}

          </div>

        </div>

      )}


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero-section">

        <div className="hero-copy">

          <span className="hero-tag">
            <i />
            A SHARED DIGITAL WORLD
          </span>

          <h1>
            Claim your
            <span>
              territory.
            </span>
          </h1>

          <p>
            A living 20 × 20 canvas where
            every move is shared in real time.
            Pick a cell. Leave your mark.
          </p>

        </div>


        {/* PLAYER CARD */}

        {user && (

          <div
            className="player-card"
            style={{
              "--player-color":
                user.color,
            } as React.CSSProperties}
          >

            <div
              className="player-avatar"
              style={{
                background:
                  user.color,
              }}
            >
              {user.username
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>

              <small>
                PLAYING AS
              </small>

              <strong>
                {user.username}
              </strong>

              <span>
                {myClaimedCount}
                {" "}
                territories
              </span>

            </div>

            <div className="player-live">
              ●
            </div>

          </div>

        )}

      </section>


      {/* =====================================================
          STAT STRIP
      ===================================================== */}

      <section className="stats-strip">

        <div>
          <small>
            CELLS
          </small>

          <strong>
            {stats?.total_cells ??
              400}
          </strong>
        </div>


        <div>
          <small>
            CLAIMED
          </small>

          <strong>
            {stats?.claimed_cells ??
              0}
          </strong>
        </div>


        <div>
          <small>
            OPEN
          </small>

          <strong>
            {stats?.available_cells ??
              0}
          </strong>
        </div>


        <div>
          <small>
            PLAYERS
          </small>

          <strong>
            {stats?.total_users ??
              0}
          </strong>
        </div>


        <div className="occupancy">

          <div>
            <small>
              OCCUPANCY
            </small>

            <strong>
              {stats?.claim_percentage ??
                0}%
            </strong>
          </div>

          <div className="occupancy-bar">
            <span
              style={{
                width: `${
                  stats?.claim_percentage ??
                  0
                }%`,
              }}
            />
          </div>

        </div>

      </section>


      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="main-layout">

        {/* ===================================================
            GRID
        =================================================== */}

        <section className="grid-card">

          <div className="section-header">

            <div>

              <span>
                TERRITORY MAP
              </span>

              <h2>
                Live Canvas
              </h2>

            </div>

            <div className="grid-status">

              <i />

              SYNCED

            </div>

          </div>


          <div className="grid-container">

            <div className="grid">

              {cells.map(
                cell => {

                  const isMine =
                    cell.owner_id ===
                    user?.id;


                  return (

                    <button
                      key={cell.id}
                      type="button"

                      className={[
                        "cell",
                        cell.owner_id
                          ? "claimed"
                          : "open",
                        isMine
                          ? "mine"
                          : "",
                      ].join(" ")}

                      style={{
                        "--cell-color":
                          cell.color ||
                          "transparent",
                      } as React.CSSProperties}

                      disabled={
                        Boolean(
                          cell.owner_id
                        ) ||
                        claimingId !==
                          null
                      }

                      onClick={() =>
                        handleCellClick(
                          cell
                        )
                      }

                      title={
                        cell.owner_name
                          ? `${cell.owner_name} owns this cell`
                          : `Claim cell ${cell.id}`
                      }
                    >

                      {!cell.owner_id && (
                        <span>
                          +
                        </span>
                      )}

                      {isMine && (
                        <b>
                          ◆
                        </b>
                      )}

                    </button>

                  );
                }
              )}

            </div>

          </div>


          <div className="grid-footer">

            <span>
              <i className="open-dot" />
              Available
            </span>

            <span>
              <i
                className="mine-dot"
                style={{
                  background:
                    user?.color,
                }}
              />
              Your territory
            </span>

            <span>
              <i className="claimed-dot" />
              Occupied
            </span>

            <span className="grid-hint">
              Click an empty cell to claim it
            </span>

          </div>

        </section>


        {/* ===================================================
            SIDEBAR
        =================================================== */}

        <aside className="sidebar">

          {/* LEADERBOARD */}

          <section className="side-card">

            <div className="side-header">

              <div>
                <small>
                  COMMUNITY
                </small>

                <h3>
                  Leaderboard
                </h3>
              </div>

              <span className="side-symbol">
                ♛
              </span>

            </div>


            {topUser && (

              <div
                className="champion"
                style={{
                  "--champion-color":
                    topUser.color,
                } as React.CSSProperties}
              >

                <div
                  className="champion-avatar"
                  style={{
                    background:
                      topUser.color,
                  }}
                >
                  {topUser.username
                    .charAt(0)}
                </div>

                <div>

                  <small>
                    CURRENT LEADER
                  </small>

                  <strong>
                    {topUser.username}
                  </strong>

                </div>

                <b>
                  {topUser.cells_claimed}
                </b>

              </div>

            )}


            <div className="leader-list">

              {leaderboard.map(
                entry => (

                  <div
                    key={
                      entry.user_id
                    }
                    className={
                      entry.user_id ===
                      user?.id
                        ? "leader-row current"
                        : "leader-row"
                    }
                  >

                    <span>
                      {String(
                        entry.rank
                      ).padStart(2, "0")}
                    </span>

                    <i
                      style={{
                        background:
                          entry.color,
                      }}
                    />

                    <strong>
                      {entry.username}
                    </strong>

                    <b>
                      {entry.cells_claimed}
                    </b>

                  </div>

                )
              )}

            </div>

          </section>


          {/* YOUR STATS */}

          <section className="side-card personal-card">

            <small>
              YOUR TERRITORY
            </small>

            <div className="personal-number">
              {myClaimedCount}
            </div>

            <p>
              cells currently controlled
            </p>

            <div className="personal-bar">

              <span
                style={{
                  width: `${
                    stats?.total_cells
                      ? Math.min(
                          100,
                          (
                            myClaimedCount /
                            stats.total_cells
                          ) *
                            100
                        )
                      : 0
                  }%`,
                  background:
                    user?.color,
                }}
              />

            </div>

          </section>

        </aside>

      </main>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer>

        <span>
          LIVEGRID
        </span>

        <span>
          React · FastAPI · PostgreSQL · WebSockets
        </span>

        <span>
          {stats?.total_claims ??
            0} claims recorded
        </span>

      </footer>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (

        <div className="toast">

          <span>
            !
          </span>

          <p>
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>

        </div>

      )}

    </div>
  );
}


export default App;