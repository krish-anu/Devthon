#!/bin/bash

# ============================================
# Docker Development Helper Script
# ============================================
# Convenient commands for managing the Docker development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Command functions
cmd_start() {
    print_header "Starting Docker Services"
    print_info "Building and starting all services..."
    docker compose up --build
}

cmd_start_local() {
    print_header "Starting Docker Services (Local DB)"
    print_info "Building and starting all services with local database..."
    export DATABASE_URL="postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash"
    export DIRECT_URL="postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash"
    docker compose --profile local-db up --build
}

cmd_start_local_detached() {
    print_header "Starting Docker Services (Local DB, Detached)"
    print_info "Building and starting all services with local database in background..."
    export DATABASE_URL="postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash"
    export DIRECT_URL="postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash"
    docker compose --profile local-db up --build -d
    print_success "Services started successfully!"
    echo ""
    print_info "Access the application:"
    echo "  Frontend:  http://localhost:3000"
    echo "  Backend:   http://localhost:4000/api"
    echo "  API Docs:  http://localhost:4000/api/docs"
    echo ""
    print_info "View logs with: ./docker-dev.sh logs"
}

cmd_start_detached() {
    print_header "Starting Docker Services (Detached)"
    print_info "Building and starting all services in background..."
    docker compose up --build -d
    print_success "Services started successfully!"
    echo ""
    print_info "Access the application:"
    echo "  Frontend:  http://localhost:3000"
    echo "  Backend:   http://localhost:4000/api"
    echo "  API Docs:  http://localhost:4000/api/docs"
    echo ""
    print_info "View logs with: ./docker-dev.sh logs"
}

cmd_stop() {
    print_header "Stopping Docker Services"
    docker compose down
    print_success "Services stopped successfully!"
}

cmd_restart() {
    print_header "Restarting Docker Services"
    docker compose restart
    print_success "Services restarted successfully!"
}

cmd_logs() {
    print_header "Viewing Logs"
    if [ -z "$2" ]; then
        print_info "Following logs for all services (Ctrl+C to exit)..."
        docker compose logs -f
    else
        print_info "Following logs for $2 (Ctrl+C to exit)..."
        docker compose logs -f "$2"
    fi
}

cmd_status() {
    print_header "Service Status"
    docker compose ps
}

cmd_clean() {
    print_header "Cleaning Up"
    print_warning "This will stop all services and remove containers."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down
        print_success "Cleanup complete!"
    else
        print_info "Cleanup cancelled."
    fi
}

cmd_clean_all() {
    print_header "Deep Clean"
    print_warning "This will stop all services, remove containers, volumes, and images."
    print_error "⚠️  ALL DATABASE DATA WILL BE LOST!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down -v --rmi all
        print_success "Deep clean complete!"
    else
        print_info "Deep clean cancelled."
    fi
}

cmd_shell() {
    print_header "Opening Shell"
    if [ -z "$2" ]; then
        print_error "Please specify a service: backend, frontend, or db"
        exit 1
    fi
    
    case "$2" in
        backend|frontend)
            print_info "Opening shell in $2 container..."
            docker compose exec "$2" sh
            ;;
        db)
            print_info "Opening PostgreSQL shell..."
            docker compose exec db psql -U trash2cash -d trash2cash
            ;;
        *)
            print_error "Unknown service: $2"
            print_info "Available services: backend, frontend, db"
            exit 1
            ;;
    esac
}

cmd_migrate() {
    print_header "Database Migration"
    if [ -z "$2" ]; then
        print_info "Running pending migrations..."
        docker compose exec backend npx prisma migrate deploy
    else
        print_info "Creating new migration: $2"
        docker compose exec backend npx prisma migrate dev --name "$2"
    fi
    print_success "Migration complete!"
}

cmd_seed() {
    print_header "Seeding Database"
    print_info "Running database seed..."
    docker compose exec backend npm run seed
    print_success "Database seeded successfully!"
}

cmd_studio() {
    print_header "Opening Prisma Studio"
    print_info "Starting Prisma Studio..."
    print_info "Access at: http://localhost:5555"
    docker compose exec backend npx prisma studio
}

cmd_reset() {
    print_header "Resetting Database"
    print_warning "This will delete all data and re-run migrations."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose exec backend npx prisma migrate reset --force
        print_success "Database reset complete!"
    else
        print_info "Reset cancelled."
    fi
}

cmd_help() {
    cat << EOF

${BLUE}Docker Development Helper Script${NC}

${GREEN}Usage:${NC}
  ./docker-dev.sh [command] [options]

${GREEN}Commands:${NC}
  ${YELLOW}start${NC}              Start all services (foreground)
  ${YELLOW}start-bg${NC}           Start all services (background/detached)
    ${YELLOW}start-local${NC}        Start all services with local DB (foreground)
    ${YELLOW}start-local-bg${NC}     Start all services with local DB (background)
  ${YELLOW}stop${NC}               Stop all services
  ${YELLOW}restart${NC}            Restart all services
  ${YELLOW}logs${NC} [service]     View logs (all or specific service)
  ${YELLOW}status${NC}             Show service status
  ${YELLOW}clean${NC}              Stop and remove containers
  ${YELLOW}clean-all${NC}          Stop and remove everything (including data!)
  
  ${YELLOW}shell${NC} <service>    Open shell in container (backend|frontend|db)
  ${YELLOW}migrate${NC} [name]     Run migrations or create new migration
  ${YELLOW}seed${NC}               Seed the database
  ${YELLOW}studio${NC}             Open Prisma Studio
  ${YELLOW}reset${NC}              Reset database (deletes all data!)
  
  ${YELLOW}help${NC}               Show this help message

${GREEN}Examples:${NC}
  ./docker-dev.sh start-bg          # Start in background
  ./docker-dev.sh logs backend      # View backend logs
  ./docker-dev.sh shell backend     # Open backend shell
  ./docker-dev.sh migrate add_user  # Create new migration
  ./docker-dev.sh studio            # Open Prisma Studio

${GREEN}Quick Access:${NC}
  Frontend:  http://localhost:3000
  Backend:   http://localhost:4000/api
  API Docs:  http://localhost:4000/api/docs
  Database:  localhost:5432

EOF
}

# Main script logic
case "$1" in
    start)
        cmd_start
        ;;
    start-bg|start-detached)
        cmd_start_detached
        ;;
    start-local)
        cmd_start_local
        ;;
    start-local-bg)
        cmd_start_local_detached
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    logs)
        cmd_logs "$@"
        ;;
    status|ps)
        cmd_status
        ;;
    clean)
        cmd_clean
        ;;
    clean-all)
        cmd_clean_all
        ;;
    shell|exec)
        cmd_shell "$@"
        ;;
    migrate)
        cmd_migrate "$@"
        ;;
    seed)
        cmd_seed
        ;;
    studio)
        cmd_studio
        ;;
    reset)
        cmd_reset
        ;;
    help|--help|-h|"")
        cmd_help
        ;;
    *)
        print_error "Unknown command: $1"
        print_info "Run './docker-dev.sh help' for usage information"
        exit 1
        ;;
esac
