# Copilot Instructions for AI Coding Agents

## Project Overview
- This is a Symfony-based PHP web application for a football club, with a separate Vite/JS frontend in `frontend/` and a public asset root in `public/`.
- Backend code is in `app/`, with domain logic in `src/`, configuration in `config/`, and templates in `templates/`.
- Database migrations are in `app/migrations/`. Doctrine ORM is used for persistence.
- The project uses Docker Compose for local development, with separate files for DB and phpMyAdmin.

## Key Workflows
- **Build/Dev:**
  - Backend: Use Symfony CLI or `bin/console` for commands (e.g., `bin/console doctrine:migrations:migrate`).
  - Frontend: Use Vite (`frontend/`), with `npm run dev` for development and `npm run build` for production assets.
  - Docker: Use `docker-compose.yml` for full stack, `docker-compose.db.yml` for DB only, and `docker-compose.phpmyadmin.yml` for DB admin.
- **Testing:**
  - PHPUnit config: `app/phpunit.dist.xml`. Run tests with `bin/phpunit`.
  - Static analysis: Use `bin/docker-phpstan` (PHPStan), `bin/docker-phpcs` (PHP_CodeSniffer), and `bin/docker-php-cs-fixer` for code style.
- **Debugging:**
  - Symfony logs are in `app/var/log/`. Use `bin/console debug:*` commands for diagnostics.

## Project Conventions
- **Directory Structure:**
  - `src/Entity/`: Doctrine entities
  - `src/Repository/`: Doctrine repositories
  - `src/Controller/`: Symfony controllers (API and web)
  - `src/Service/`: Business logic/services
  - `templates/`: Twig templates, organized by feature
- **Naming:**
  - Migration files: `Version<timestamp>.php`
  - Services and controllers follow Symfony naming conventions
- **Configuration:**
  - Environment variables via `.env` (not in repo)
  - Service wiring in `config/services.yaml`
  - Routing in `config/routes.yaml` and `config/routes/`

## Integration Points
- **Database:** MySQL via Doctrine ORM
- **Frontend:** Communicates via API endpoints defined in `src/Controller/ApiResource/`
- **Authentication:** JWT (see `config/jwt/`)
- **External:** Google OAuth (see `client_secret_*.json` in `app/`)

## Examples
- Add a new entity: Create in `src/Entity/`, update `src/Repository/`, generate migration, run `bin/console app:doctrine:migrate`.
- Add an API endpoint: Create controller in `src/Controller/ApiResource/`, define route in `config/routes/`.

## Tips
- Use Docker scripts in `app/bin/` for consistent tooling.
- Check `TODO.md` and `COMMANDS.md` in `app/` for project-specific notes and commands.
- For asset changes, rebuild frontend and clear Symfony cache (`bin/console cache:clear`).

---
_If any section is unclear or missing important project-specific details, please provide feedback for further refinement._
