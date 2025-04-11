// src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import SongSetup from './components/SongSetup';
import GameRoom from './components/GameRoom';
// Palautetaan oikea import-polku
import JoinOrCreateGame from './components/JoinOrCreateGame';
// Tuo Firestore-instanssi ja Firestore-funktiot
import { db } from './firebase';
import {
    collection, // Viittaa kokoelmaan
    query, // Luo kysely
    orderBy, // Järjestä tulokset
    onSnapshot, // Reaaliaikainen kuuntelija
    addDoc, // Lisää dokumentti (auto-ID)
    deleteDoc, // Poista dokumentti
    doc, // Viittaa yksittäiseen dokumenttiin
    updateDoc, // Päivitä dokumentti
    serverTimestamp, // Palvelimen aikaleima
    increment, // Atominen laskuri
    setDoc, // Käytetään setDocia tunnetulla ID:llä (current_game)
    getDoc, // Haetaan yksittäinen dokumentti (seuraavaa kappaletta varten)
    limit, // Rajoitetaan kyselyitä
    where, // Ehtolausekkeet kyselyihin
    getDocs, // Haetaan dokumentteja (seuraavaa kappaletta varten)
    Timestamp // Tarvitaan luodun session tarkistukseen
} from "firebase/firestore";
import { FiPlayCircle, FiRotateCw } from 'react-icons/fi'; // Lisätään FiRotateCw

// BACKEND API URL nimen hakua varten
const NAME_FETCH_API_URL = 'http://localhost:3001/api/fetch-and-add-song';
// Firestore Game State Document ID
const GAME_STATE_DOC_ID = "current_game";

// Suomenkieliset käännökset ja ikonien nimet
const finnishTexts = {
    joinOrCreate: {
        title: "Liity tai Luo Pelisessio",
        joinTitle: "Liity Olemassaolevaan Peliin",
        codeInputLabel: "Syötä 6-numeroinen koodi:",
        joining: "Liitytään...",
        joinButton: "Liity Peliin",
        createTitle: "Luo Uusi Peli",
        creating: "Luodaan...",
        createButton: "Luo Uusi Peli",
        errorPrefix: "Virhe",
        joinIcon: "FiLogIn",
        createIcon: "FiPlusCircle"
    },
    setup: {
        manageSongs: "Hallinnoi Kappaleita",
        songUrlLabel: "Kappaleen URL (esim. YouTube):",
        addSongButton: "Lisää Kappale",
        addingSong: "Lisätään...",
        songListTitle: "Kappalelista",
        noSongs: "Ei lisättyjä kappaleita vielä.",
        deleteButton: "Poista",
        managePlayers: "Hallinnoi Pelaajia",
        playerNameLabel: "Pelaajan Nimi:",
        addPlayerButton: "Lisää Pelaaja",
        playerListTitle: "Pelaajalista",
        noPlayers: "Ei lisättyjä pelaajia vielä.",
        score: "Pisteet",
        playerNamePlaceholder: "Syötä pelaajan nimi",
        addIcon: "FiPlus",
        deleteIcon: "FiTrash2",
        playersIcon: "FiUsers",
        songsIcon: "FiMusic"
    },
    gameRoom: {
        title: "Arvaa Kappale!",
        loading: "Ladataan seuraavaa kappaletta...",
        errorPrefix: "Virhe",
        selectNextSong: "Valitse 'Seuraava Kappale' aloittaaksesi.",
        nextSongButton: "Seuraava Kappale",
        playSnippetButton: "Soita Näyte",
        playMoreButton: "Soita 10s Lisää",
        revealButton: "Paljasta Nimi",
        titleHidden: "(Nimi piilotettu)",
        revealedTitlePrefix: "Nimi:",
        playersTitle: "Pelaajat",
        score: "Pisteet",
        nextIcon: "FiSkipForward",
        playIcon: "FiPlay",
        playMoreIcon: "FiChevronsRight",
        revealIcon: "FiEye",
        startGameButton: "Aloita Peli",
        startGameIcon: "FiPlayCircle",
        restartGameButton: "Pelaa Uudelleen",
        restartGameIcon: "FiRotateCw"
    },
    app: {
        mainTitle: "Harjunpään musiikkibingo",
        loadingSession: "Ladataan pelisessiota",
        sessionCode: "Sessiokoodi",
        sessionError: "Sessiovirhe",
        setupTab: "Asetukset",
        gameRoomTab: "Pelihuone",
        allSongsPlayed: "Kaikki kappaleet soitettu!"
    }
};

function App() {
  // --- Sessio Tila ---
  const [sessionCode, setSessionCode] = useState(null); // Aluksi null
  const [isProcessingJoinCreate, setIsProcessingJoinCreate] = useState(false);
  const [joinCreateError, setJoinCreateError] = useState(null);

  // --- Peli Tila (Session sisällä) ---
  const [songs, setSongs] = useState([]);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState(null); // Tila keskitetylle pelitilalle
  const [currentView, setCurrentView] = useState('setup');
  const [isLoadingSongs, setIsLoadingSongs] = useState(true);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(true);
  const [isLoadingGameState, setIsLoadingGameState] = useState(true);
  const [error, setError] = useState(null);
  const [playFirstSnippetAutomatically, setPlayFirstSnippetAutomatically] = useState(false);

  // Helper-funktio virheiden käsittelyyn (yleisille virheille)
  const handleAsyncError = (message, error) => {
    console.error(message, error);
    setError(`${message}: ${error?.message || 'Tuntematon virhe'}`);
  };

  // --- Firestore Polut (dynaamiset session mukaan) ---
  const getSessionDocRef = useCallback(() => {
    if (!sessionCode) return null;
    return doc(db, "game_sessions", sessionCode);
  }, [sessionCode]);

  const getSongsCollectionRef = useCallback(() => {
     if (!sessionCode) return null;
     return collection(getSessionDocRef(), "songs");
  }, [sessionCode, getSessionDocRef]);

  const getPlayersCollectionRef = useCallback(() => {
      if (!sessionCode) return null;
      return collection(getSessionDocRef(), "players");
  }, [sessionCode, getSessionDocRef]);

  const getGameStateDocRef = useCallback(() => {
       if (!sessionCode) return null;
       // Käytetään tunnettua ID:tä "game_state" session dokumentin sisällä
       return doc(getSessionDocRef(), "state", "current_game");
   }, [sessionCode, getSessionDocRef]);

  // --- Firestore Reaaliaikaiset Kuuntelijat (Aktivoituu kun sessionCode on asetettu) ---

  // Kuuntele kappaleita
  useEffect(() => {
    if (!sessionCode) return; // Älä tee mitään ilman sessiota
    const songsCollectionRef = getSongsCollectionRef();
    if (!songsCollectionRef) return;

    setError(null);
    setIsLoadingSongs(true);
    console.log(`Setting up songs listener for session ${sessionCode}...`);
    const q = query(songsCollectionRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const songsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setSongs(songsData);
      setIsLoadingSongs(false);
      console.log(`Songs updated for session ${sessionCode}:`, songsData.length);
    }, (err) => {
      handleAsyncError(`Failed to load songs for session ${sessionCode}.`, err);
      setIsLoadingSongs(false);
    });
    return () => { console.log(`Cleaning up songs listener for session ${sessionCode}.`); unsubscribe(); };
  }, [sessionCode, getSongsCollectionRef]); // Aja uudelleen jos sessionCode muuttuu

  // Kuuntele pelaajia
  useEffect(() => {
    if (!sessionCode) return;
    const playersCollectionRef = getPlayersCollectionRef();
    if (!playersCollectionRef) return;

    setError(null);
    setIsLoadingPlayers(true);
    console.log(`Setting up players listener for session ${sessionCode}...`);
    const q = query(playersCollectionRef, orderBy("name"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const playersData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setPlayers(playersData);
      setIsLoadingPlayers(false);
      console.log(`Players updated for session ${sessionCode}:`, playersData.length);
    }, (err) => {
      handleAsyncError(`Failed to load players for session ${sessionCode}.`, err);
      setIsLoadingPlayers(false);
    });
    return () => { console.log(`Cleaning up players listener for session ${sessionCode}.`); unsubscribe(); };
  }, [sessionCode, getPlayersCollectionRef]);

  // Kuuntele pelitilaa
  useEffect(() => {
    if (!sessionCode) return;
    const gameStateDocRef = getGameStateDocRef();
    if (!gameStateDocRef) return;

    setError(null);
    setIsLoadingGameState(true);
    console.log(`Setting up game state listener for session ${sessionCode}...`);

    const unsubscribe = onSnapshot(gameStateDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setGameState(data);
        console.log(`Game state updated for session ${sessionCode}:`, data?.playbackState);
      } else {
        console.log(`Game state document not found for session ${sessionCode}, initializing.`);
        const initialGameState = {
            currentSongId: null,
            currentSongUrl: null,
            currentSongTitle: null,
            playbackState: 'paused',
            seekTime: 0,
            lastActionTimestamp: serverTimestamp(),
            error: null,
            playedSongIds: [] // Lisätään soitettujen seuranta
        };
        setDoc(gameStateDocRef, initialGameState)
            .then(() => {
                console.log(`Initial game state created for session ${sessionCode}.`);
                setGameState(initialGameState);
            })
            .catch(err => handleAsyncError(`Failed to create initial game state for session ${sessionCode}.`, err));
        setGameState(null);
      }
      setIsLoadingGameState(false);
    }, (err) => {
      handleAsyncError(`Failed to load game state for session ${sessionCode}.`, err);
      setIsLoadingGameState(false);
    });

    return () => { console.log(`Cleaning up game state listener for session ${sessionCode}.`); unsubscribe(); };
  }, [sessionCode, getGameStateDocRef]);

  // --- Pelitilan päivitysfunktiot (Firestoreen, sessiokohtaiset) ---

  const updateFirestoreGameState = useCallback(async (newState) => {
    const gameStateDocRef = getGameStateDocRef();
    if (!gameStateDocRef) return Promise.reject("Session not active");
    console.log(`Updating Firestore game state for session ${sessionCode}:`, newState);
    try {
        await setDoc(gameStateDocRef, {
             ...newState,
             lastActionTimestamp: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        handleAsyncError(`Failed to update game state in Firestore for session ${sessionCode}.`, error);
        throw error;
    }
  }, [sessionCode, getGameStateDocRef]);

  // Seuraavan kappaleen valinta (sessiokohtainen)
  const selectNextSong = useCallback(async (options = {}) => {
    const songsCollectionRef = getSongsCollectionRef();
    const gameStateDocRef = getGameStateDocRef();
    if (!songsCollectionRef || !gameStateDocRef || (!gameState && !options.forceResetPlayedIds)) return;

    const playedIdsToExclude = options.forceResetPlayedIds ? [] : gameState?.playedSongIds || [];

    console.log(`Selecting next song for session ${sessionCode}. Played IDs to exclude:`, playedIdsToExclude);
    setError(null);
    await updateFirestoreGameState({ 
        playbackState: 'loading', 
        error: null,
        snippetPlayedOnce: false 
      });

    try {
        // --- UUSI LOGIIKKA: Hae kaikki ID:t ja suodata clientilla --- 
        console.log("Fetching all song IDs...");
        const allSongsSnapshot = await getDocs(query(songsCollectionRef)); // Hae kaikki dokumentit (ID:t riittää)
        const allSongIds = allSongsSnapshot.docs.map(doc => doc.id);
        console.log(`Found ${allSongIds.length} total songs.`);

        const availableSongIds = allSongIds.filter(id => !playedIdsToExclude.includes(id));
        console.log(`Found ${availableSongIds.length} available songs after filtering.`);

        if (availableSongIds.length === 0) {
            // --- Käsittele tilanne, kun kappaleet loppu --- 
            const noSongsMessage = (allSongIds.length === 0 || options.forceResetPlayedIds) 
                ? "No songs available to play." 
                : (finnishTexts.app.allSongsPlayed || "Kaikki kappaleet soitettu!");
            console.log(`No available songs left. Message: ${noSongsMessage}`);
            await updateFirestoreGameState({
                currentSongId: null,
                currentSongUrl: null,
                currentSongTitle: noSongsMessage,
                // Aseta error-tila jos kappaleita ei ole ollenkaan
                playbackState: (allSongIds.length === 0) ? 'error' : 'finished',
                error: (allSongIds.length === 0) ? "No songs added to this session." : null,
                playedSongIds: playedIdsToExclude 
            });
        } else {
            // --- Valitse satunnainen ja hae sen data --- 
            const randomIndex = Math.floor(Math.random() * availableSongIds.length);
            const nextSongId = availableSongIds[randomIndex];
            console.log(`Selected random available song ID: ${nextSongId}`);

            const nextSongDocRef = doc(songsCollectionRef, nextSongId);
            const nextSongDoc = await getDoc(nextSongDocRef);

            if (!nextSongDoc.exists()) {
                throw new Error(`Selected song document with ID ${nextSongId} does not exist!`);
            }
            
            const nextSongData = nextSongDoc.data();
            console.log(`Fetched data for next song: ${nextSongId} - ${nextSongData.title}`);

            // Päivitä pelitila
            await updateFirestoreGameState({
                currentSongId: nextSongId,
                currentSongUrl: nextSongData.url,
                currentSongTitle: nextSongData.title,
                playbackState: 'paused', 
                seekTime: 0,
                error: null,
                snippetPlayedOnce: false,
                playedSongIds: [...playedIdsToExclude, nextSongId] 
            });
        }
         // --- UUSI LOGIIKKA LOPPUU --- 
    } catch (err) {
        console.error(`[selectNextSong] Error:`, err); // Lisätty konteksti virhelokiin
        handleAsyncError(`Failed to select next song for session ${sessionCode}.`, err);
        await updateFirestoreGameState({ playbackState: 'error', error: `Failed to select next song: ${err.message}` });
    }
  }, [sessionCode, gameState?.playedSongIds, getSongsCollectionRef, getGameStateDocRef, updateFirestoreGameState, handleAsyncError]);

  // --- Muut käsittelijäfunktiot (sessiokohtaiset) ---

  // -- Songs --
  const addSong = useCallback(async (url) => {
    const songsCollectionRef = getSongsCollectionRef();
    if (!songsCollectionRef || !sessionCode) {
        throw new Error("Sessio ei ole aktiivinen kappaleen lisäämiseksi.");
    }
    console.log(`Attempting to add song with URL: ${url} to session ${sessionCode} via backend...`);

    try {
      const response = await fetch(NAME_FETCH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, sessionCode }), // Lähetä sessionCode backendille
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend error data:', errorData);
        // Heitetään virhe, jonka SongSetup ottaa kiinni
        throw new Error(errorData.message || `Backend failed with status ${response.status}`);
      }

      const result = await response.json();
      console.log('Song added successfully via backend:', result);
      // Backend lisää kappaleen Firestoreen, kuuntelija päivittää tilan

    } catch (err) {
      console.error('Error adding song via backend:', err);
      // Heitetään virhe eteenpäin SongSetup-komponentille
      // Ei aseteta yleistä error-tilaa tässä
      // handleAsyncError('Error adding song via backend', err);
      throw err; // Heitä alkuperäinen tai uusi virhe
    }
  }, [sessionCode, getSongsCollectionRef]); // Lisätty riippuvuudet

  const deleteSong = async (id) => {
      const songsCollectionRef = getSongsCollectionRef();
      if (!songsCollectionRef) return;
      setError(null);
      const songDocRef = doc(songsCollectionRef, id);
      console.log(`Attempting to delete song: ${id} from session ${sessionCode}`);
      try {
        await deleteDoc(songDocRef);
        console.log(`Song ${id} deleted from session ${sessionCode}.`);
        if (gameState?.currentSongId === id) {
            console.log("Deleted song was the current song, selecting next.");
            selectNextSong();
        }
      } catch (err) {
        handleAsyncError("Failed to delete song.", err);
      }
  };

  // -- Players --
  const addPlayer = async (name) => {
      const playersCollectionRef = getPlayersCollectionRef();
      if (!playersCollectionRef) return;
      if (!name || !name.trim()) { alert('Player name cannot be empty.'); return; }
      setError(null);
      const trimmedName = name.trim();
      console.log(`Attempting to add player: ${trimmedName} to session ${sessionCode}`);
      try {
        const q = query(playersCollectionRef, where("nameLower", "==", trimmedName.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            throw new Error(`Player name '${trimmedName}' already exists in this session.`);
        }
        await addDoc(playersCollectionRef, {
          name: trimmedName,
          nameLower: trimmedName.toLowerCase(),
          score: 0,
          createdAt: serverTimestamp()
        });
        console.log(`Player ${trimmedName} added to session ${sessionCode}.`);
      } catch (err) {
        handleAsyncError("Failed to add player.", err);
      }
  };

  const deletePlayer = async (id) => {
      const playersCollectionRef = getPlayersCollectionRef();
      if (!playersCollectionRef) return;
      setError(null);
      const playerDocRef = doc(playersCollectionRef, id);
      console.log(`Attempting to delete player: ${id} from session ${sessionCode}`);
      try {
        await deleteDoc(playerDocRef);
        console.log(`Player ${id} deleted from session ${sessionCode}.`);
      } catch (err) {
        handleAsyncError("Failed to delete player.", err);
      }
  };

  const updatePlayerScore = async (id, amount) => {
      const playersCollectionRef = getPlayersCollectionRef();
      if (!playersCollectionRef) return;
      setError(null);
      const playerDocRef = doc(playersCollectionRef, id);
      console.log(`Attempting to update score for player ${id} in session ${sessionCode} by ${amount}`);
      try {
          const playerSnap = await getDoc(playerDocRef);
          if (playerSnap.exists()) {
              const currentScore = playerSnap.data().score || 0;
              const newScore = Math.max(0, currentScore + amount);
              await updateDoc(playerDocRef, { score: newScore });
              console.log(`Score updated for player ${id} to ${newScore}`);
          } else {
               throw new Error("Player not found for score update.");
          }
      } catch (err) {
          handleAsyncError("Failed to update score.", err);
      }
  };

  // --- Session Hallinta ---

  const generateSessionCode = () => {
      return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleCreateGame = async () => {
      setIsProcessingJoinCreate(true);
      setJoinCreateError(null);
      let newCode = null;
      let attempts = 0;
      const maxAttempts = 5;

      try {
           // Yritä luoda uniikki koodi muutaman kerran
           while (attempts < maxAttempts) {
                newCode = generateSessionCode();
                const sessionRef = doc(db, "game_sessions", newCode);
                const docSnap = await getDoc(sessionRef);
                if (!docSnap.exists()) {
                     // Koodi on vapaa, luodaan sessio
                    await setDoc(sessionRef, {
                        createdAt: serverTimestamp(),
                        // Tässä voit lisätä muita session metatietoja tarvittaessa
                    });
                    // Luo myös state-alikokoelma ja current_game-dokumentti heti
                     const gameStateRef = doc(sessionRef, "state", "current_game");
                     await setDoc(gameStateRef, {
                        currentSongId: null, currentSongUrl: null, currentSongTitle: null,
                        playbackState: 'paused', seekTime: 0, error: null,
                        lastActionTimestamp: serverTimestamp(), playedSongIds: []
                     });
                     console.log("New game session created with code:", newCode);
                     setSessionCode(newCode); // Liity luotuun peliin
                     setCurrentView('setup'); // Mene setup-näkymään
                     setIsProcessingJoinCreate(false);
                     return;
                }
                console.log(`Code ${newCode} already exists, generating new one...`);
                attempts++;
           }
           throw new Error("Failed to generate a unique session code after several attempts.");
      } catch (error) {
            console.error("Error creating game session:", error);
            setJoinCreateError(error.message || finnishTexts.joinOrCreate.errorPrefix + ": Pelisession luonti epäonnistui.");
            setIsProcessingJoinCreate(false);
      }
  };

  const handleJoinGame = async (code) => {
       setIsProcessingJoinCreate(true);
       setJoinCreateError(null);
       try {
            const sessionRef = doc(db, "game_sessions", code);
            const docSnap = await getDoc(sessionRef);

            if (docSnap.exists()) {
                 console.log("Joining existing game session:", code);
                 setSessionCode(code);
                 setCurrentView('setup'); // Mene setup-näkymään
            } else {
                 throw new Error(finnishTexts.joinOrCreate.errorPrefix + ": Virheellinen sessiokoodi. Peliä ei löytynyt.");
            }
       } catch (error) {
            console.error("Error joining game session:", error);
            setJoinCreateError(error.message || finnishTexts.joinOrCreate.errorPrefix + ": Pelisessioon liittyminen epäonnistui.");
       }
        setIsProcessingJoinCreate(false);
  };

  // --- Pelin aloitusfunktio ---
  const handleStartGame = useCallback(async () => {
      if (!sessionCode) return;
      console.log(`Starting game for session ${sessionCode}...`);
      try {
        setPlayFirstSnippetAutomatically(false);
        // Nollaa snippetPlayedOnce TÄSSÄ ENNEN selectNextSong -kutsua
        // Koska selectNextSong asettaa sen loading-tilassa falseksi
        // await updateFirestoreGameState({ snippetPlayedOnce: false }); // Ei välttämättä tarvita, selectNextSong hoitaa?
        // Kutsu selectNextSong, joka nollaa snippetPlayedOnce
        await selectNextSong();
        setPlayFirstSnippetAutomatically(true);
      } catch (err) {
        handleAsyncError(`Failed to start game for session ${sessionCode}.`, err);
      }
    }, [sessionCode, selectNextSong, handleAsyncError, updateFirestoreGameState]); // Lisätty updateFirestoreGameState riippuvuuksiin varmuuden vuoksi

  // --- Uusi Pelin Uudelleenaloitusfunktio ---
  const handleRestartGame = useCallback(async () => {
      if (!sessionCode) return;
      console.log(`[handleRestartGame] Restarting game for session ${sessionCode}...`);
      setError(null);
      setPlayFirstSnippetAutomatically(false);
      try {
          console.log('[handleRestartGame] Resetting playedSongIds in Firestore...');
          // Nollaa playedSongIds, selectNextSong hoitaa snippetPlayedOnce-nollauksen
          await updateFirestoreGameState({
               playedSongIds: [],
              });
          console.log('[handleRestartGame] Firestore playedSongIds reset. Calling selectNextSong with forceReset...');
          // Kutsu selectNextSong, joka nollaa snippetPlayedOnce loading-vaiheessa
          await selectNextSong({ forceResetPlayedIds: true }); 
          console.log('[handleRestartGame] selectNextSong completed. Setting playFirstSnippetAutomatically=true.');
          setPlayFirstSnippetAutomatically(true);
      } catch (err) {
          console.error('[handleRestartGame] Error restarting game:', err);
          handleAsyncError(`Failed to restart game for session ${sessionCode}.`, err);
          await updateFirestoreGameState({ playbackState: 'error', error: `Failed to restart game: ${err.message}` });
      }
  }, [sessionCode, updateFirestoreGameState, selectNextSong, handleAsyncError]); // selectNextSong on edelleen riippuvuus

  // --- Näkymän vaihto ---
   const handleViewChange = (view) => {
       if (view === 'game' && currentView === 'setup') {
           // Nollaa mahdollisesti vanha pelitila näkymää vaihdettaessa
           // Tämä on tärkeää, jotta "Aloita Peli" -nappi näkyy oikein
           // (Voisi myös tarkemmin nollata vain currentSongUrl tms.)
           console.log(`Switching to game view for session ${sessionCode}. Resetting volatile game state.`);
           // Huom: Kuuntelija voi yliajaa tämän heti, jos Firestoresta tulee eri data.
           // Varmistetaan, ettei automaattisoitto jää päälle
            setPlayFirstSnippetAutomatically(false);
       }
       setCurrentView(view);
   };

  // Renderöinti
  if (!sessionCode) {
    // Näytä liittymis/luomisnäkymä
    return (
      <div className="App">
        <h1>{finnishTexts.app.mainTitle}</h1>
        <JoinOrCreateGame
          onJoin={handleJoinGame}
          onCreate={handleCreateGame}
          isLoading={isProcessingJoinCreate}
          error={joinCreateError}
          texts={finnishTexts.joinOrCreate}
        />
      </div>
    );
  }

  // Näytä pääsovellus session koodilla
  return (
    <div className="App">
      <header className="App-header">
        <h1>{finnishTexts.app.mainTitle}</h1>
        <div className="session-info">
            {finnishTexts.app.sessionCode}: <strong>{sessionCode}</strong>
        </div>
      </header>
      {isLoadingSongs || isLoadingPlayers || isLoadingGameState ? (
          <p>{finnishTexts.app.loadingSession}...</p>
      ) : error ? (
          <p className="error-message">{finnishTexts.app.sessionError}: {error}</p>
      ) : (
        <>
          {/* --- Navigointivälilehdet --- */}
          <nav className="view-tabs">
            <button
              onClick={() => handleViewChange('setup')}
              // Lisätään luokat: button, tab-button ja active ehdollisesti
              className={`button tab-button ${currentView === 'setup' ? 'active' : ''}`}
            >
              {finnishTexts.app.setupTab}
        </button>
            <button
              onClick={() => handleViewChange('game')}
              // Lisätään luokat: button, tab-button ja active ehdollisesti
              className={`button tab-button ${currentView === 'game' ? 'active' : ''}`}
            >
             {finnishTexts.app.gameRoomTab}
        </button>
      </nav>

          {/* --- Näkymän sisältö --- */}
          <div className="view-content">
        {currentView === 'setup' && (
          <SongSetup
            songs={songs}
            onAddSong={addSong}
            onDeleteSong={deleteSong}
            players={players}
            onAddPlayer={addPlayer}
            onDeletePlayer={deletePlayer}
                texts={finnishTexts.setup}
          />
        )}
            {currentView === 'game' && (
          <GameRoom
            songs={songs}
            players={players}
            onUpdateScore={updatePlayerScore}
                gameState={gameState}
                onUpdateRequest={updateFirestoreGameState}
                onSelectNextSong={selectNextSong}
                onStartGame={handleStartGame}
                onRestartGame={handleRestartGame}
                playFirstSnippet={playFirstSnippetAutomatically}
                onSnippetPlayed={() => setPlayFirstSnippetAutomatically(false)}
                texts={finnishTexts.gameRoom}
              />
            )}
          </div>
        </>
      )}

      {/* --- Globaalit JSX Tyylit --- */}
      <style jsx global>{`
          /* Perus body-tyylit (jos App.css:ää ei käytetä paljoa) */
          body {
            font-family: sans-serif;
            margin: 0;
            background-color: #f0f2f5; /* Kevyt taustaväri */
          }
          .App {
            max-width: 800px; /* Leveysrajoitus */
            margin: 20px auto; /* Keskitys ja marginaali */
            padding: 20px;
            background-color: #ffffff; /* Valkoinen tausta sovellukselle */
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .App-header {
            text-align: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #dee2e6;
          }
          .App-header h1 {
            margin: 0 0 0.5rem 0;
            color: #343a40;
          }
          .session-info {
             background-color: #e9ecef;
             padding: 0.3rem 0.6rem;
             border-radius: 4px;
             display: inline-block; /* Ei vie koko leveyttä */
             font-size: 0.9rem;
             color: #495057;
          }
          .error-message {
             /* Yleinen virheilmoitus */
             color: #721c24;
             background-color: #f8d7da;
             border: 1px solid #f5c6cb;
             padding: 0.75rem 1.25rem;
             border-radius: 0.25rem;
             margin-bottom: 1rem;
             text-align: center;
          }
      `}</style>

      {/* --- Komponenttikohtaiset JSX Tyylit --- */}
      <style jsx>{`
        .view-tabs {
          display: flex;
          justify-content: center; /* Keskittää napit */
          gap: 1rem; /* Väliä nappien välille */
          margin-bottom: 1.5rem; /* Väliä sisällön yläpuolelle */
        }

        /* Otetaan yleinen .button-tyyli pohjaksi, mutta tehdään muutoksia */
        .button.tab-button {
          padding: 0.5rem 1rem; /* Hieman pienempi padding */
          font-size: 1rem;
          background-color: #e9ecef; /* Oletustausta */
          color: #495057; /* Oletusteksti */
          border: 1px solid #dee2e6;
          flex-grow: 0; /* Ei kasva täyttämään tilaa */
          opacity: 0.8; /* Hieman himmeämpi oletuksena */
          transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
        }

        .button.tab-button:hover {
          background-color: #dee2e6; /* Tummempi hoverissa */
          color: #212529;
          opacity: 1;
        }

        /* Aktiivisen välilehden tyyli */
        .button.tab-button.active {
          background-color: #007bff; /* Sininen aktiiviselle */
          color: white;
          border-color: #007bff;
          font-weight: bold;
          opacity: 1;
        }

        /* Ei tarvita disabled-tyyliä erikseen, koska emme käytä sitä tässä */

        .view-content {
            margin-top: 1.5rem; /* Lisätään tilaa välilehtien ja sisällön väliin */
        }
      `}</style>
    </div>
  );
}

export default App;