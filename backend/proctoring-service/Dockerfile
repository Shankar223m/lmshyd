# syntax=docker/dockerfile:1
#
# Build context is lms-backend/ (every service depends on ./shared, the lms-common package):
#   docker build -f proctoring-service/Dockerfile -t lms-proctoring-service lms-backend/
# docker compose does this for you (see docker-compose.yml).

FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY shared /shared
COPY proctoring-service/requirements.txt proctoring-service/requirements-yolo.txt ./
# requirements.txt lists the shared package as an editable path for local development (`-e ../shared`);
# in the image it is installed normally, so the runtime stage needs only the virtualenv.
RUN sed 's#^-e \.\./shared#/shared#' requirements.txt > requirements.docker.txt \
    && python -m venv /opt/venv && /opt/venv/bin/pip install -r requirements.docker.txt
# Object detection (phone, book, laptop, extra person): CPU-only PyTorch + ultralytics. Build with --build-arg INSTALL_YOLO=0
# for a small image without it (faces are still checked). ultralytics pulls the full OpenCV, which needs libGL, so the
# headless build is put back afterwards.
ARG INSTALL_YOLO=1
RUN if [ "$INSTALL_YOLO" = "1" ]; then       /opt/venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu       && /opt/venv/bin/pip install -r requirements-yolo.txt       && /opt/venv/bin/pip uninstall -y opencv-python       && /opt/venv/bin/pip install --force-reinstall --no-deps "opencv-python-headless>=4.8,<5";     fi

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"     YOLO_CONFIG_DIR=/tmp/Ultralytics
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app proctoring-service/alembic.ini ./
COPY --chown=app:app proctoring-service/alembic ./alembic
COPY --chown=app:app proctoring-service/app ./app
COPY --chown=app:app proctoring-service/models ./models

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live', timeout=2).status == 200 else 1)"

# Migrations run as a separate step (see docker-compose `proctoring-service-migrate`), never on app start.
# The background worker uses this same image with `python -m app.worker`.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
