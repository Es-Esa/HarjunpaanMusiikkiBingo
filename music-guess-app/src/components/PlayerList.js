// src/components/PlayerList.js
import React from 'react';

function PlayerList({ players, onUpdateScore }) {
  return (
    <ul className="player-list">
      {players.length === 0 && <p>Ei pelaajia lisätty vielä.</p>}
      {players.map(player => (
        <li key={player.id} className="player-item">
          <span className="player-info">{player.name}</span>
          <div className="score-controls">
            <button
              onClick={() => onUpdateScore(player.id, -1)}
              disabled={player.score <= 0} // Disable decrement if score is 0
              className="decrease"
              title="Decrease Score"
            >
              -
            </button>
            <span className="player-score">{player.score}</span>
            <button
                onClick={() => onUpdateScore(player.id, 1)}
                className="increase"
                title="Increase Score"
            >
                +
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default PlayerList;