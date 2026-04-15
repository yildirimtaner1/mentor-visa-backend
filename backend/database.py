import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Get the directory of the current file to place the db alongside it
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Read from env, but fallback to local sqlite
database_url_env = os.getenv("DATABASE_URL", "")

# SQLAlchemy 1.4+ requires postgresql:// instead of postgres://
if database_url_env.startswith("postgres://"):
    database_url_env = database_url_env.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = database_url_env if database_url_env else f"sqlite:///{os.path.join(BASE_DIR, 'mentorvisa.db')}"

# Create engine (SQLite requires check_same_thread, Postgres doesn't)
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
