import os

import psycopg


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://localhost/livegrid_db",
)


def get_connection():
    return psycopg.connect(DATABASE_URL)