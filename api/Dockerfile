FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt requirements-pilot.txt ./
RUN pip install --no-cache-dir -r requirements-pilot.txt
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
