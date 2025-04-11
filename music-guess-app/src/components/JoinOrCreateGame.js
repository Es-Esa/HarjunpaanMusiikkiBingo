// src/components/JoinOrCreateGame.js
import React, { useState } from 'react';
// Tuodaan ikonit, lisätään FiAlertCircle
import { FiLogIn, FiPlusCircle, FiLoader, FiAlertCircle } from 'react-icons/fi';

// Päivitetään propsien nimet: onJoinGame -> onJoin, onCreateGame -> onCreate
// Lisätään texts ja isLoading prop (aiemmin isProcessing)
function JoinOrCreateGame({ onJoin, onCreate, error, isLoading, texts }) {
  const [code, setCode] = useState('');

  // Haetaan ikonien nimet ja tekstit texts-propista tai käytetään oletuksia
  const t = texts || {
      title: "Liity tai Luo Pelisessio",
      joinTitle: "Liity Olemassaolevaan Peliin",
      codeInputLabel: "Syötä 6-numeroinen koodi:",
      joining: "Liitytään...",
      joinButton: "Liity Peliin",
      createTitle: "Luo Uusi Peli",
      creating: "Luodaan...",
      createButton: "Luo Uusi Peli",
      errorPrefix: "Virhe",
      joinIcon: FiLogIn, // Käytetään suoraan ikonia
      createIcon: FiPlusCircle
  };

  // Muutetaan isLoadingin tarkistus
  const isProcessing = isLoading; 

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const handleJoinClick = () => {
    // Käytetään onJoin-propsia
    if (code.length === 6 && !isProcessing) {
      onJoin(code);
    }
  };

  const handleCreateClick = () => {
    // Käytetään onCreate-propsia
    if (!isProcessing) {
      onCreate();
    }
  };

  // Helper komponentti napin sisällölle (teksti + ikoni + latausikoni)
  const ButtonContent = ({ text, icon: Icon, loadingText }) => (
    <>
      {isProcessing ? <FiLoader className="spin" /> : <Icon />}
      {isProcessing ? loadingText : text}
    </>
  );

  return (
    <div className="join-or-create-container">
      <h2>{t.title}</h2>

      <div className="section join-section">
        <h3>{t.joinTitle}</h3>
        <div className="input-group">
          <label htmlFor="sessionCode">{t.codeInputLabel}</label>
          <input
            type="text"
            id="sessionCode"
            value={code}
            onChange={handleInputChange}
            placeholder="123456"
            maxLength="6"
            pattern="\d*"
            inputMode="numeric"
            disabled={isProcessing}
            aria-label={t.codeInputLabel}
          />
        </div>
        <button
          onClick={handleJoinClick}
          disabled={code.length !== 6 || isProcessing}
          className="button join-button" // Käytetään yleistä .button-luokkaa
        >
          <ButtonContent text={t.joinButton} icon={t.joinIcon} loadingText={t.joining} />
        </button>
      </div>

      <div className="section create-section">
        <h3>{t.createTitle}</h3>
        <button
          onClick={handleCreateClick}
          disabled={isProcessing}
          className="button create-button" // Käytetään yleistä .button-luokkaa
        >
          <ButtonContent text={t.createButton} icon={t.createIcon} loadingText={t.creating} />
        </button>
      </div>

      {error && <p className="error-message"><FiAlertCircle /> {t.errorPrefix}: {error}</p>}

      <style jsx>{`
        .join-or-create-container {
          max-width: 500px;
          margin: 40px auto;
          padding: 2rem; /* Lisätty paddingia */
          background-color: #f8f9fa; /* Vaaleampi tausta */
          border: 1px solid #dee2e6; /* Harmaa reunus */
          border-radius: 8px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05); /* Kevyt varjo */
        }
        h2 {
            margin-bottom: 1.5rem;
            color: #343a40;
        }
        h3 {
          color: #495057;
          margin-bottom: 1rem;
          border-bottom: 1px solid #e9ecef; /* Vaaleampi reunus */
          padding-bottom: 0.5rem;
        }
        .section {
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          /* Poistettu border-bottom, koska h3:lla on jo */
        }
        .create-section {
          border-bottom: none;
          padding-bottom: 0;
        }
        .input-group {
          margin-bottom: 1rem;
        }
        .input-group label {
          display: block;
          margin-bottom: 0.5rem; /* Pienennetty väliä */
          font-weight: bold;
          color: #495057;
        }
        .input-group input {
          /* Otetaan tyyli SongSetupista */
          padding: 0.6rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          width: 100%;
          box-sizing: border-box;
          text-align: center; /* Keskitetään koodi */
          font-size: 1.2rem; /* Isompi fontti koodille */
          letter-spacing: 0.2em; /* Väliä numeroille */
        }

        /* Yleinen nappityyli GameRoomista */
        .button {
          padding: 0.7rem 1.2rem;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          transition: background-color 0.2s ease, opacity 0.2s ease;
          font-size: 1rem; /* Normaali fonttikoko */
          flex-grow: 0; /* Ei kasva oletuksena */
          text-align: center;
          white-space: nowrap;
          width: 100%; /* Napit vievät koko leveyden */
        }
        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
         .button:not(:disabled):hover {
           filter: brightness(110%);
         }

        /* Nappikohtaiset värit */
        .join-button {
          background-color: #007bff; /* Sininen */
        }
        .create-button {
          background-color: #28a745; /* Vihreä */
        }

        .error-message {
          color: #dc3545;
          background-color: #f8d7da;
          padding: 0.5rem 0.8rem;
          border-radius: 4px;
          margin-top: 1.5rem;
          display: inline-flex; /* Näytä ikoni ja teksti */
          align-items: center;
          gap: 0.5rem;
          font-weight: normal;
        }

         /* Animaatio latausikonille */
        .spin {
            animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default JoinOrCreateGame;