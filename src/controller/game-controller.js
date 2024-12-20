import jwt from 'jsonwebtoken';
import { shuffleDeck, dealCards, allCards } from '../utils/deck-utils.js';

const secretKey = process.env.JWT_SECRET;

let waitingPlayer = null;
const games = {};

export function handleGameConnection(io, socket) {
  socket.on('search_game', (token) => {
  
    const username = validateToken(token);
    if (!username) {
      socket.emit('error', { message: 'Invalid token' });
      return;
    }
  
    if (waitingPlayer === null) {
      waitingPlayer = { socket, username };
      console.log(`Jugador 1 conectado: ${username}`);
      socket.emit('waiting', { message: 'Esperando rival...' });
    } else {
      console.log(`Jugador 2 conectado: ${username}`);
      console.log(`Emparejando jugadores: ${waitingPlayer.username} vs ${username}`);
      const gameId = setupNewGame(io, waitingPlayer, socket, username);
      console.log(`Partida ${gameId} creada.`);
      waitingPlayer = null;
    }
  });
  
  socket.on('play_card', (data) => {
    const token = data.token;
    const card = data.card;
    const gameId = data.gameId;

    if (!token) {
      console.error('No token provided');
      socket.emit('error', { message: 'No token provided' });
      return;
    }

    const username = validateToken(token);
    if (!username) {
      console.error('Invalid token');
      socket.emit('error', { message: 'Invalid token' });
      return;
    }

    const game = games[gameId];
    if (!game) {
      console.error('Game not found');
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (!card) {
      console.error(`El jugador ${username} intentó jugar una carta nula`);
      socket.emit('error', { message: 'Invalid card' });
      return;
    }

    const player = game.players.find((p) => p.username === username);
    if (!player || !player.hand.includes(card)) {
      console.error('Invalid card or not your turn');
      socket.emit('error', { message: 'Invalid card or not your turn' });
      return;
    }

    if (game.currentTurn !== player.role) {
      console.error('Invalid card or not your turn');
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    console.log(`El jugador ${username} ha tirado la carta ${card}`);

    player.hand = player.hand.filter((c) => c !== card);

    game.currentRound.push({ player: player.role, card });

    const currentPlayerIndex = game.players.findIndex(
      (p) => p.role === player.role
    );
    const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
    const nextPlayer = game.players[nextPlayerIndex];

    io.in(gameId).emit('card_played', {
      card: card,
      playedBy: player.role,
      currentTurn: nextPlayer.role,
      initialCard: game.currentRound[0].card,
    });

    game.currentTurn = nextPlayer.role;

    if (game.currentRound.length === game.players.length) {
      handleRoundFinish(io, game, gameId);
    }
  }
  );

  socket.on('cantar', (data) => {
    const points = data.points;
    const suit = data.suit;
    const player = data.player;
    const gameId = data.gameId;
    const game = games[gameId];

    if (!game) {
      console.error('Game not found or game is undefined');
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const currentPlayer = game.players.find((p) => p.socket.id === socket.id);
    if (!currentPlayer) {
      console.error(`No player found with socket id: ${socket.id}`);
      socket.emit('error', { message: 'Player not found' });
      return;
    }
    console.log(`Petición de cantar recibida de :${currentPlayer}`);

    if (currentPlayer) {
      game.teamPoints[currentPlayer.team] += points;

      io.in(gameId).emit('cantar_notificacion', {
        player: currentPlayer.username,
        points,
        suit,
        team1Points: game.teamPoints[1],
        team2Points: game.teamPoints[2],
      });

      console.log(
        `Jugador ${currentPlayer.username} cantó ${points} puntos en el palo ${suit}`
      );
    }
  });

  socket.on('exchange_seven', (data) => {
    const gameId = data.gameId;
    const token = data.token;
    const username = validateToken(token);
    if (!username) {
      console.error('Invalid token');
      socket.emit('error', { message: 'Invalid token' });
      return;
    }

    const game = games[gameId];
    if (!game) {
      console.error('Game not found');
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    const player = game.players.find((p) => p.username === username);
    const triumphSuit = game.triunfoCard.replace(/\d+$/, '');
    const sevenCard = `${triumphSuit}7`;
    const previousTriunfoCard = game.triunfoCard;
    
    if (!player.hand.includes(sevenCard)) {
      console.error('El jugador no tiene el 7 del triunfo');
      socket.emit('error', { message: 'No tienes el 7 del triunfo' });
      return;
    }
    player.hand = player.hand.map((card) =>
      card === sevenCard ? game.triunfoCard : card
    );
    game.triunfoCard = sevenCard;
    io.in(gameId).emit('seven_exchanged', {
      player: player.role,
      newTriunfo: sevenCard,
      exchangedCard: previousTriunfoCard,
    });
    console.log(
      `Player ${player.role} exchanged ${sevenCard} for new triunfo card ${game.triunfoCard}`
    );
  });

  socket.on('disconnect', () => {
    console.log('A player disconnected:', socket.id);
    if (waitingPlayer && waitingPlayer.socket === socket) {
      waitingPlayer = null;
    }
  });
}

function setupNewGame(io, waitingPlayer, playerSocket, playerUsername) {
  const gameId = `game_${playerSocket.id}_${waitingPlayer.socket.id}`;
  const shuffledDeck = shuffleDeck([...allCards]);
  const { player1Cards, player2Cards, triunfoCard } = dealCards(shuffledDeck);

  const game = {
    players: [
      {
        role: 'player1',
        username: waitingPlayer.username,
        hand: player1Cards,
        socket: waitingPlayer.socket,
        team: 1,
      },
      {
        role: 'player2',
        username: playerUsername,
        hand: player2Cards,
        socket: playerSocket,
        team: 2,
      },
    ],
    triunfoCard,
    currentTurn: 'player1',
    currentRound: [],
    teamPoints: { 1: 0, 2: 0 },
    deck: shuffledDeck,
    deVueltas: false,
  };

  games[gameId] = game;

  waitingPlayer.socket.join(gameId);
  playerSocket.join(gameId);
  emitGameStart(io, gameId, waitingPlayer, playerSocket, player1Cards, player2Cards, triunfoCard, playerUsername);

  return gameId;
}


function emitGameStart(io, gameId, waitingPlayer, playerSocket, player1Cards, player2Cards, triunfoCard, playerUsername) {
  const playersInfo = [
    { role: 'player1', username: waitingPlayer.username },
    { role: 'player2', username: playerUsername },
  ];

  waitingPlayer.socket.emit('game_start', {
    message: 'Partida encontrada',
    gameId,
    players: playersInfo,
    myRole: 'player1',
    playerCards: player1Cards,
    triunfoCard,
    currentTurn: 'player1',
  });

  playerSocket.emit('game_start', {
    message: 'Partida encontrada',
    gameId,
    players: playersInfo,
    myRole: 'player2',
    playerCards: player2Cards,
    triunfoCard,
    currentTurn: 'player1',
  });  
}


function dealInitialCards(deck) {
  const player1Cards = [];
  const player2Cards = [];

  for (let i = 0; i < 6; i++) {
    player1Cards.push(deck.pop());
    player2Cards.push(deck.pop());
  }

  return { player1Cards, player2Cards };
}


// Cuando hay dos cartas del mismo palo, gana la que tiene más fuerza
function getCardStrength(card) {
  const cardValue = card.replace(/[a-zA-Z]+/, '');

  const strength = {
    1: 9,
    3: 8,
    12: 7,
    10: 6,
    11: 5,
    7: 4,
    6: 3,
    5: 2,
    4: 1,
    2: 0,
  };

  return strength[cardValue] || 0;
}

function getCardSuit(card) {
  if (!card) {
    console.error('La carta es nula o indefinida.');
    return null;
  }
  return card.replace(/\d+/, '');
}

function getCardValue(card) {
  const cardValue = card.replace(/[a-zA-Z]+/, '');

  const values = {
    1: 11,
    3: 10,
    12: 4,
    10: 3,
    11: 2,
    7: 0,
    6: 0,
    5: 0,
    4: 0,
    2: 0,
  };

  return values[cardValue] || 0;
}

function validateToken(token) {
  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded.username;
  } catch (err) {
    console.error(
      `Token validation failed for token: ${token}. Error: ${err.message}`
    );
    return null;
  }
}

function handleRoundFinish(io, game, gameId) {

  const triunfoSuit = getCardSuit(game.triunfoCard);
  const winnerRole = determineRoundWinner(game.currentRound, triunfoSuit);
  const points = calculateRoundPoints(game.currentRound);

  const winningPlayer = game.players.find((p) => p.role === winnerRole);
  game.teamPoints[winningPlayer.team] += points;

  const team1Points = game.teamPoints[1];
  const team2Points = game.teamPoints[2];

  console.log('=== Resumen de la ronda ===');
  console.log(`Cartas jugadas:`);
  game.currentRound.forEach(({ player, card }) => {
    console.log(`${player} jugó la carta ${card} de ${card}`);
  });
  console.log(`Ganador de la ronda: ${winnerRole}`);
  console.log(`Puntos ganados en la ronda: ${points}`);
  console.log(
    `Puntos totales: Equipo 1: ${team1Points}, Equipo 2: ${team2Points}
      Quedan : ${game.deck.length} cartas en el mazo.`
  );
  console.log('==========================');
  io.in(gameId).emit('round_winner', {
    winner: winnerRole,
    pointsGained: points,
    team1Points,
    team2Points,
    nextTurn: winnerRole,
  });

  game.currentRound = [];

  if (game.isDeVueltas && (team1Points >= 100 || team2Points >= 100)) {
    handleGameEnded(io, gameId, team1Points, team2Points);
    return;
  }

  game.currentTurn = winnerRole;

  game.players.forEach((player) => {
    const newCard = popCard(io, game, gameId);

    if (newCard) {
      console.log(`Repartiendo la carta ${newCard} a ${player.username}`);
      player.hand.push(newCard);
      player.socket.emit('new_card', { newCard });
    }
  });

  if (game.players.every((player) => player.hand.length === 0)) {
    handleFinal(io, game, winningPlayer, gameId);
  }
}

function determineRoundWinner(cards, triunfoSuit) {
  const firstCard = cards[0].card;
  let winningCard = firstCard;
  let winningPlayer = cards[0].player;

  for (let i = 1; i < cards.length; i++) {
    const currentCard = cards[i].card;

    const currentCardSuit = getCardSuit(currentCard);
    const winningCardSuit = getCardSuit(winningCard);

    if (currentCardSuit === triunfoSuit && winningCardSuit !== triunfoSuit) {
      winningCard = currentCard;
      winningPlayer = cards[i].player;
    } else if (currentCardSuit === winningCardSuit) {
      if (getCardStrength(currentCard) > getCardStrength(winningCard)) {
        winningCard = currentCard;
        winningPlayer = cards[i].player;
      }
    }
  }

  return winningPlayer;
}

function calculateRoundPoints(cards) {
  return cards.reduce((total, { card }) => total + getCardValue(card), 0);
}

function popCard(io, game, gameId) {
  if (game.deck.length > 0) {
    return game.deck.pop();
  } else if (game.deck.length === 0 && game.triunfoCard) {
    const card = game.triunfoCard;
    game.triunfoCard = null;
    io.in(gameId).emit('de_ultimas', {
      message: '¡De últimas!',
    });
    console.log(`Emitido evento 'de_ultimas' para la sala ${game.gameId}`);
    return card;
  } else {
    // return handleDeUltimas(io, game);
  }
}

function handleDeUltimas(io, game) {
  // Lógica para controlar ir de últimas
}

function handleFinal(io, game, winningPlayer, gameId) {
  console.log('Última mano ganada por:', winningPlayer.role);
  game.teamPoints[winningPlayer.team] += 10;
  console.log(`Equipo ${winningPlayer.team} ha ganado las 10 últimas.`);

  const team1Points = game.teamPoints[1];
  const team2Points = game.teamPoints[2];

  if (team1Points >= 100 || team2Points >= 100) {
    handleGameEnded(io, gameId, team1Points, team2Points);
  } else {
    handleDeVueltas(io, game, winningPlayer, gameId);
  }
}

function handleGameEnded(io, gameId, team1Points, team2Points) {
  const winner = team1Points > team2Points ? 'Equipo 1' : 'Equipo 2';
  console.log('=== Partida terminada ===');
  console.log(`Equipo ganador: ${winner}`);
  console.log(`Puntos totales: Equipo 1: ${team1Points}, Equipo 2: ${team2Points}`);
  console.log('=========================');

  io.in(gameId).emit('game_ended', {
    team1Points,
    team2Points,
    winner,
  });
}

function handleDeVueltas(io, game, winningPlayer, gameId) {
  console.log('Ningún equipo ha alcanzado los 100 puntos. Vamos de vueltas.');

  game.currentRound = []; 
  game.deck = shuffleDeck([...allCards]);
  game.triunfoCard = game.deck.pop();
  game.players.forEach((player) => {
    player.hand = dealInitialCards(game.deck); 
  });

  const winningPlayerIndex = game.players.findIndex((p) => p.role === winningPlayer.role);
  const nextPlayerIndex = (winningPlayerIndex + 1) % game.players.length; 
  game.currentTurn = game.players[nextPlayerIndex].role;

  io.in(gameId).emit('de_vueltas', {
    message: 'Ningún equipo ha alcanzado los 100 puntos. Vamos de vueltas.',
    team1Points: game.teamPoints[1],
    team2Points: game.teamPoints[2],
    triunfoCard: game.triunfoCard,
    playerHands: game.players.map((player) => ({
      role: player.role,
      hand: player.hand,
    })),
    currentTurn: game.currentTurn,
  });

  console.log('=== Nueva partida de vueltas iniciada ===');
  console.log(`Puntos iniciales: Equipo 1: ${game.teamPoints[1]}, Equipo 2: ${game.teamPoints[2]}`);
  console.log(`Triunfo: ${game.triunfoCard}`);
  console.log(`Turno inicial: ${game.currentTurn}`);
}


