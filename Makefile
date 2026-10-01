.PHONY: up down seed migrate test logs backend-test frontend-test

up:
	docker compose up --build -d

down:
	docker compose down

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.seed

test: backend-test frontend-test

backend-test:
	docker compose exec backend pytest -v

frontend-test:
	docker compose exec frontend npm test -- --run

logs:
	docker compose logs -f
