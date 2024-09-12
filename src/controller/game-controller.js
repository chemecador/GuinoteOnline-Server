import jwt from "jsonwebtoken";
import { shuffleDeck, dealCards, allCards } from "../utils/deck-utils.js";

const secretKey = process.env.JWT_SECRET;

let waitingPlayer = null;
const games = {};

export function handleGameConnection(io, socket) {
  console.log("A player connected:", socket.id);

  socket.on("search_game", (token) => {
    console.log(`Petición de search_game recibida del token: ${token}`);

    const username = validateToken(token);
    if (!username) {
      socket.emit("error", { message: "Invalid token" });
      return;
    }

    if (waitingPlayer === null) {
      waitingPlayer = { socket, username };
      console.log(`Jugador 1 conectado: ${username}`);
      socket.emit("waiting", { message: "Esperando rival..." });
    } else {
      const gameId = `game_${socket.id}_${waitingPlayer.socket.id}`;
      socket.join(gameId);
      waitingPlayer.socket.join(gameId);

      console.log(`Jugador 2 conectado: ${username}`);
      console.log(
        `Emparejando jugadores: ${waitingPlayer.username} vs ${username}`
      );

      const shuffledDeck = shuffleDeck([...allCards]);
      const { player1Cards, player2Cards, triunfoCard } =
        dealCards(shuffledDeck);

      games[gameId] = {
        players: [
          {
            role: "player1",
            username: waitingPlayer.username,
            hand: player1Cards,
            socket: waitingPlayer.socket,
            team: 1,
          },
          {
            role: "player2",
            username: username,
            hand: player2Cards,
            socket: socket,
            team: 2,
          },
        ],
        triunfoCard,
        currentTurn: "player1",
        currentRound: [],
        teamPoints: { 1: 0, 2: 0 },
        deck: shuffledDeck,
      };

      waitingPlayer.socket.emit("game_start", {
        message: "Partida encontrada",
        gameId,
        players: [
          { role: "player1", username: waitingPlayer.username },
          { role: "player2", username: username },
        ],
        myRole: "player1",
        playerCards: player1Cards,
        triunfoCard,
        currentTurn: "player1",
      });

      socket.emit("game_start", {
        message: "Partida encontrada",
        gameId,
        players: [
          { role: "player1", username: waitingPlayer.username },
          { role: "player2", username: username },
        ],
        myRole: "player2",
        playerCards: player2Cards,
        triunfoCard,
        currentTurn: "player1",
      });

      waitingPlayer = null;
    }
  });

  socket.on("play_card", (data) => {
    const token = data.token;
    const card = data.card;
    const gameId = data.gameId;

    if (!token) {
      console.error("No token provided");
      socket.emit("error", { message: "No token provided" });
      return;
    }

    const username = validateToken(token);
    if (!username) {
      socket.emit("error", { message: "Invalid token" });
      return;
    }

    const game = games[gameId];
    if (!game) {
      socket.emit("error", { message: "Game not found" });
      return;
    }

    if (!card) {
      console.error(`El jugador ${username} intentó jugar una carta nula`);
      socket.emit("error", { message: "Invalid card" });
      return;
    }

    const player = game.players.find((p) => p.username === username);
    if (!player || !player.hand.includes(card)) {
      console.error("Invalid card or not your turn");
      socket.emit("error", { message: "Invalid card or not your turn" });
      return;
    }

    if (game.currentTurn !== player.role) {
      console.error("Invalid card or not your turn");
      socket.emit("error", { message: "Not your turn" });
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

    io.in(gameId).emit("card_played", {
      card: card,
      playedBy: player.role,
      currentTurn: nextPlayer.role,
    });

    game.currentTurn = nextPlayer.role;

    if (game.currentRound.length === game.players.length) {
      const triunfoSuit = getCardSuit(game.triunfoCard);

      const winnerRole = determineRoundWinner(game.currentRound, triunfoSuit);

      const points = calculateRoundPoints(game.currentRound);

      const winningPlayer = game.players.find((p) => p.role === winnerRole);
      game.teamPoints[winningPlayer.team] += points;

      const team1Points = game.teamPoints[1];
      const team2Points = game.teamPoints[2];

      console.log("=== Resumen de la ronda ===");
      console.log(`Cartas jugadas:`);
      game.currentRound.forEach(({ player, card }) => {
        console.log(`${player} jugó la carta ${card} de ${card}`);
      });
      console.log(`Ganador de la ronda: ${winnerRole}`);
      console.log(`Puntos ganados en la ronda: ${points}`);
      console.log(
        `Puntos totales: Equipo 1: ${team1Points}, Equipo 2: ${team2Points}`
      );
      console.log("==========================");

      io.in(gameId).emit("round_winner", {
        winner: winnerRole,
        pointsGained: points,
        team1Points,
        team2Points,
        nextTurn: winnerRole,
      });

      game.currentRound = [];

      game.currentTurn = winnerRole;

      game.players.forEach((player) => {
        let newCard;

        if (game.deck.length === 0 && game.triunfoCard) {
          newCard = game.triunfoCard;
          game.triunfoCard = null;
        } else if (game.deck.length > 0) {
          newCard = game.deck.pop();
        } else {
          io.in(gameId).emit("deck_empty");
          return;
        }

        if (newCard) {
          console.log(`Repartiendo la carta ${newCard} a ${player.username}`);
          player.hand.push(newCard);
          player.socket.emit("new_card", { newCard });
        }
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("A player disconnected:", socket.id);
    if (waitingPlayer && waitingPlayer.socket === socket) {
      waitingPlayer = null;
    }
  });
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

// Cuando hay dos cartas del mismo palo, gana la que tiene más fuerza
function getCardStrength(card) {
  const cardValue = card.replace(/[a-zA-Z]+/, "");

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
    console.error("La carta es nula o indefinida.");
    return null;
  }
  return card.replace(/\d+/, "");
}

function getCardValue(card) {
  const cardValue = card.replace(/[a-zA-Z]+/, "");

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
