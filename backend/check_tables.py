import sqlite3

conn = sqlite3.connect('mentorvisa.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
print("Tables:", cursor.fetchall())

cursor.execute("PRAGMA table_info('z_old_evaluations');")
print("z_old_evaluations columns:", cursor.fetchall())

cursor.execute("PRAGMA table_info('evaluations');")
print("evaluations columns:", cursor.fetchall())

conn.close()
