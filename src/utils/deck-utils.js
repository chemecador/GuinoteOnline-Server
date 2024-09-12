export const allCards = [
  "bastos1",
  "bastos2",
  "bastos3",
  "bastos4",
  "bastos5",
  "bastos6",
  "bastos7",
  "bastos10",
  "bastos11",
  "bastos12",
  "copas1",
  "copas2",
  "copas3",
  "copas4",
  "copas5",
  "copas6",
  "copas7",
  "copas10",
  "copas11",
  "copas12",
  "espadas1",
  "espadas2",
  "espadas3",
  "espadas4",
  "espadas5",
  "espadas6",
  "espadas7",
  "espadas10",
  "espadas11",
  "espadas12",
  "oros1",
  "oros2",
  "oros3",
  "oros4",
  "oros5",
  "oros6",
  "oros7",
  "oros10",
  "oros11",
  "oros12",
];

export function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function dealCards(deck) {
  const player1Cards = deck.splice(0, 6);
  const player2Cards = deck.splice(0, 6);
  const triunfoCard = deck.pop();
  return { player1Cards, player2Cards, triunfoCard };
}
