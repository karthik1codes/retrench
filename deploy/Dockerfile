FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src
COPY graph ./graph
COPY segment.yaml ./
RUN pip install --no-cache-dir -e .
ENTRYPOINT ["python", "-m", "signalscout"]
CMD ["run", "--config", "segment.yaml"]
