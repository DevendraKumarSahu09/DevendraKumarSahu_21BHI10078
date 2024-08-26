// Import required modules
const express = require('express'); // Express framework for handling server requests
const http = require('http'); // HTTP module to create the server
const socketIo = require('socket.io'); // Socket.io for handling real-time communications
const path = require('path'); // Path module to handle and transform file paths

// Create an Express application
const app = express();
// Create an HTTP server using the Express app
const server = http.createServer(app);
// Initialize Socket.io with the HTTP server
const io = socketIo(server);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize the game state
let gameState = {
  board: Array(5).fill().map(() => Array(5).fill(null)), // 5x5 board initialized with null values
  currentPlayer: 'A', // Player 'A' starts first
  players: {}, // Object to hold connected players
  moveHistory: [] // Array to track the history of moves
};

// Define the game pieces and their properties
const pieces = {
  'P': { name: 'Pawn', moves: ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'], range: 1 }, // Pawn with specific moves and range
  'H1': { name: 'Hero1', moves: ['F', 'B', 'L', 'R'], range: 2 }, // Hero1 with specific moves and range
  'H2': { name: 'Hero2', moves: ['FL', 'FR', 'BL', 'BR'], range: 2 }, // Hero2 with specific moves and range
  'H3': { name: 'Hero3', moves: ['FL', 'FR', 'BL', 'BR', 'RF', 'RB', 'LF', 'LB'], range: 3 } // Hero3 with specific moves and range
};

// Function to initialize the game state
function initializeGame() {
  gameState.board = [
    ['A-P1', 'A-H1', 'A-H2', 'A-H3', 'A-P2'], // Initial positions of Player A's pieces
    [null, null, null, null, null], // Empty row
    [null, null, null, null, null], // Empty row
    [null, null, null, null, null], // Empty row
    ['B-P1', 'B-H1', 'B-H2', 'B-H3', 'B-P2'] // Initial positions of Player B's pieces
  ];
  gameState.currentPlayer = 'A'; // Set current player to 'A'
  gameState.moveHistory = []; // Reset move history
}

// Function to validate if a move is legal
function isValidMove(player, fromX, fromY, toX, toY) {
  const piece = gameState.board[fromY][fromX]; // Get the piece from the board
  if (!piece || piece[0] !== player) return false; // Check if piece exists and belongs to the player
  
  const [, type] = piece.split('-'); // Extract piece type
  const pieceType = pieces[type.slice(0, 2)]; // Get piece type details
  
  if (!pieceType) return false; // If piece type is invalid, return false
  
  const dx = toX - fromX; // Calculate horizontal move distance
  const dy = toY - fromY; // Calculate vertical move distance
  
  // Check if move is out of board bounds
  if (toX < 0 || toX > 4 || toY < 0 || toY > 4) return false;

  // Check if the target position is occupied by the player's own piece
  if (gameState.board[toY][toX] && gameState.board[toY][toX][0] === player) return false;

  // Validate move based on the piece's range and if it moves
  return Math.abs(dx) <= pieceType.range && Math.abs(dy) <= pieceType.range && (dx !== 0 || dy !== 0);
}

// Function to process a move on the board
function processMove(player, fromX, fromY, toX, toY) {
  const piece = gameState.board[fromY][fromX]; // Get the moving piece
  const capturedPiece = gameState.board[toY][toX]; // Get any captured piece
  
  // Update board with the new piece positions
  gameState.board[toY][toX] = piece;
  gameState.board[fromY][fromX] = null;
  
  // Create a description of the move for history
  const moveDescription = `${piece}: (${fromX},${fromY}) to (${toX},${toY})${capturedPiece ? ` capturing ${capturedPiece}` : ''}`;
  gameState.moveHistory.push(moveDescription); // Add move to history
  
  // Switch current player
  gameState.currentPlayer = gameState.currentPlayer === 'A' ? 'B' : 'A';
  return true;
}

// Function to check if the game is over
function checkGameOver() {
  // Count remaining heroes for each player
  const aHeroes = gameState.board.flat().filter(cell => cell && cell.startsWith('A-H')).length;
  const bHeroes = gameState.board.flat().filter(cell => cell && cell.startsWith('B-H')).length;
  
  if (aHeroes === 0) return 'B'; // Player B wins
  if (bHeroes === 0) return 'A'; // Player A wins
  if (gameState.moveHistory.length >= 100) return 'draw'; // Draw if too many moves
  return null; // Game continues
}

// Handle new socket.io connections
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Handle player joining the game
  socket.on('joinGame', (player) => {
    if (!gameState.players[player]) {
      gameState.players[player] = socket.id; // Add player to game state
      socket.emit('playerAssigned', player); // Notify player of assignment
      
      // Start game when two players have joined
      if (Object.keys(gameState.players).length === 2) {
        initializeGame(); // Initialize the game state
        io.emit('gameStart', gameState); // Notify all players the game has started
      }
    } else {
      socket.emit('gameUpdate', gameState); // Update existing player with current game state
    }
  });
  
  // Handle player making a move
  socket.on('move', ({ player, fromX, fromY, toX, toY }) => {
    // Validate and process the move if it's the player's turn and the move is valid
    if (player === gameState.currentPlayer && isValidMove(player, fromX, fromY, toX, toY)) {
      processMove(player, fromX, fromY, toX, toY); // Update game state with move
      io.emit('gameUpdate', gameState); // Notify all players of the updated game state
      
      const result = checkGameOver(); // Check if the game is over
      if (result) {
        io.emit('gameOver', { result }); // Notify all players of game over and result
      }
    } else {
      socket.emit('invalidMove'); // Notify player of an invalid move
    }
  });
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    Object.keys(gameState.players).forEach(player => {
      if (gameState.players[player] === socket.id) {
        delete gameState.players[player]; // Remove player from game state
      }
    });
    // Reset game if a player disconnects
    if (Object.keys(gameState.players).length < 2) {
      gameState = {
        board: Array(5).fill().map(() => Array(5).fill(null)), // Reset board
        currentPlayer: 'A', // Reset current player
        players: {}, // Clear players
        moveHistory: [] // Clear move history
      };
      io.emit('gameReset'); // Notify all players the game has been reset
    }
  });
});

// Start the server and listen on a specific port
const PORT = process.env.PORT || 3000; // Define port number
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // Start listening
