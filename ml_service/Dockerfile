FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=5001

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# The trained model is committed, so the container never needs the dataset.
COPY app.py train.py coffee_quality_model.joblib ./

RUN useradd --create-home appuser
USER appuser

EXPOSE 5001
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT} -w 2 --timeout 60 app:app"]
