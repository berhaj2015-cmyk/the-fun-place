# README

- Project name: The Fun Place
- What it does (one sentence): A beautiful, relaxing web arcade featuring Galaga, Hangman, and Connect 4 with JWT user authentication and shared leaderboards.
- How to run it: Serve the project using a simple web server (e.g. `python3 -m http.server`) in the project directory and open the provided URL.
- Main folders/files:
  - `index.html`: The main dashboard page.
  - `style.css`: Design system and typography.
  - `main.js`: Interactivity for the main arcade dashboard.
  - `js/auth.js`: JWT token generation, validation, and session simulation.
  - `js/leaderboard.js`: High-score storage and leaderboard tracking.
  - `games/`: Folder housing individual games.
    - `shared/game-layout.css`: Shared game user interface stylesheet.
    - `galaga/`: Space-shooter themed game.
    - `hangman/`: Word-guessing blossom tree themed game.
    - `connect4/`: Token drop grid game.
  - `assets/`: Image resources, specifically `mountains.jpeg`.
- APIs used: Local JWT Simulated API endpoints.
- Skills used: [auth-implementation-patterns](file:///Users/berlinhajibrahim/Downloads/Antigravity/Skills/auth-implementation-patterns/SKILL.md)
