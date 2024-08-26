// Establish a connection to the server using Socket.IO
const socket = io();

// Variables to store game state, the assigned player, and the selected piece
let gameState = null;
let playerAssigned = null;
let selectedPiece = null;

// Function to initialize the game setup
function initializeGame() {
    // Display the player selection options
    document.getElementById('player-selection').style.display = 'block';

    // Event listeners for player selection buttons
    document.getElementById('select-player-a').addEventListener('click', () => selectPlayer('A'));
    document.getElementById('select-player-b').addEventListener('click', () => selectPlayer('B'));
}

// Function to handle player selection
function selectPlayer(player) {
    // Emit an event to join the game with the selected player ('A' or 'B')
    socket.emit('joinGame', player);
    // Hide the player selection options
    document.getElementById('player-selection').style.display = 'none';
}

// Function to render the game board
function renderBoard() {
    const board = document.getElementById('game-board');
    board.innerHTML = ''; // Clear the existing board

    // Iterate over the board's grid to create cells
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell'; // Assign the cell class

            // Get the piece at the current position
            const piece = gameState.board[y][x];
            if (piece) {
                // Display the piece and apply class based on the player
                cell.textContent = piece.split('-')[1];
                cell.classList.add(`piece-${piece[0]}`);
            }

            // Add an onclick event to select a piece
            cell.onclick = () => selectPiece(x, y);
            board.appendChild(cell); // Add the cell to the board
        }
    }
}

// Function to handle piece selection
function selectPiece(x, y) {
    // Check if it's the player's turn
    if (!gameState || gameState.currentPlayer !== playerAssigned) return;

    // Get the piece at the selected position
    const piece = gameState.board[y][x];
    if (piece && piece.startsWith(playerAssigned)) {
        selectedPiece = { x, y, type: piece.split('-')[1] }; // Store the selected piece
        document.getElementById('selected-piece').textContent = `Selected: ${piece}`; // Display the selected piece
        showMoveOptions(piece.split('-')[1]); // Show possible moves
        highlightSelectedCell(x, y); // Highlight the selected cell
    }
}

// Function to highlight the selected cell on the board
function highlightSelectedCell(x, y) {
    const cells = document.querySelectorAll('.cell'); // Get all cells
    cells.forEach(cell => cell.classList.remove('selected')); // Remove any existing highlights
    cells[y * 5 + x].classList.add('selected'); // Highlight the selected cell
}

// Function to display available move options for a piece
function showMoveOptions(pieceType) {
    const moveButtons = document.getElementById('move-buttons');
    moveButtons.innerHTML = ''; // Clear existing buttons

    // Define possible moves
    const moves = ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'];
    
    // Create a button for each move
    moves.forEach(move => {
        const button = document.createElement('button');
        button.textContent = move;
        button.onclick = () => makeMove(move); // Set onclick event to make a move
        moveButtons.appendChild(button);
    });
}

// Function to make a move
function makeMove(move) {
    if (selectedPiece) {
        // Define the move directions
        const directions = {
            'F': [0, -1], 'B': [0, 1], 'L': [-1, 0], 'R': [1, 0],
            'FL': [-1, -1], 'FR': [1, -1], 'BL': [-1, 1], 'BR': [1, 1]
        };
        
        // Calculate the new position based on the move
        const [dx, dy] = directions[move];
        const toX = selectedPiece.x + dx;
        const toY = selectedPiece.y + dy;
        
        // Emit a move event to the server with the move details
        socket.emit('move', {
            player: playerAssigned,
            fromX: selectedPiece.x,
            fromY: selectedPiece.y,
            toX: toX,
            toY: toY
        });
    }
}

// Function to update the game status display
function updateStatus() {
    const statusElement = document.getElementById('game-status');
    if (gameState) {
        // Display the current player's turn
        statusElement.textContent = `Current Player: ${gameState.currentPlayer}`;
    } else {
        // Display waiting message
        statusElement.textContent = 'Waiting for players...';
    }
}

// Function to update the move history
function updateMoveHistory() {
    const historyList = document.getElementById('history-list');
    // Render the move history as a list
    historyList.innerHTML = gameState.moveHistory.map(move => `<li>${move}</li>`).join('');
}

// Event listener for player assignment
socket.on('playerAssigned', (player) => {
    playerAssigned = player;
    console.log('Assigned as player:', player);
});

// Event listener for game start
socket.on('gameStart', (state) => {
    gameState = state; // Update the game state
    renderBoard(); // Render the game board
    updateStatus(); // Update the game status
    updateMoveHistory(); // Update the move history
});

// Event listener for game updates
socket.on('gameUpdate', (state) => {
    gameState = state; // Update the game state
    renderBoard(); // Re-render the game board
    updateStatus(); // Update the game status
    updateMoveHistory(); // Update the move history
    selectedPiece = null; // Reset selected piece
    document.getElementById('selected-piece').textContent = ''; // Clear selected piece display
    document.getElementById('move-buttons').innerHTML = ''; // Clear move options
});

// Event listener for invalid moves
socket.on('invalidMove', () => {
    alert('Invalid move! Try again.'); // Display an alert for invalid moves
});

// Event listener for game over
socket.on('gameOver', ({ result }) => {
    let message;
    if (result === 'draw') {
        message = "Game Over! It's a draw!"; // Display draw message
    } else {
        message = `Game Over! Player ${result} wins!`; // Display win message
    }
    
    // Display game over modal
    const modal = document.getElementById('game-over-modal');
    const messageElement = document.getElementById('game-over-message');
    const newGameButton = document.getElementById('new-game-button');
    
    messageElement.textContent = message;
    modal.style.display = 'block';
    
    // Event listener for the new game button
    newGameButton.onclick = () => {
        modal.style.display = 'none'; // Hide the modal
        gameState = null; // Reset game state
        selectedPiece = null; // Reset selected piece
        renderBoard(); // Re-render the board
        updateStatus(); // Update status
        document.getElementById('player-selection').style.display = 'block'; // Show player selection
    };
});

// Event listener for game reset
socket.on('gameReset', () => {
    gameState = null; // Reset game state
    selectedPiece = null; // Reset selected piece
    renderBoard(); // Re-render the board
    updateStatus(); // Update status
    // Clear move history
    document.getElementById('move-history').innerHTML = '<h3>Move History</h3><ul id="history-list"></ul>';
    document.getElementById('player-selection').style.display = 'block'; // Show player selection
});

// Initialize the game setup
initializeGame();
