// src/components/GameRoom.js
import React, { useRef, useEffect, useState } from 'react';
import ReactPlayer from 'react-player/youtube';
import PlayerList from './PlayerList';
import { FiPlay, FiSkipForward, FiChevronsRight, FiEye, FiEyeOff, FiUsers, FiLoader, FiAlertCircle, FiPlayCircle, FiRotateCw } from 'react-icons/fi';

const SNIPPET_DURATION = 10; // Play snippets of 10 seconds
const END_BUFFER_SECONDS = 40; // Don't start snippets in the last 40 seconds

function GameRoom({ songs, players, onUpdateScore, gameState, onUpdateRequest, onSelectNextSong, texts, onStartGame, onRestartGame, playFirstSnippet, onSnippetPlayed }) {
  const t = texts || {
      title: "Arvaa Kappale!",
      loading: "Ladataan seuraavaa kappaletta...",
      errorPrefix: "Virhe",
      selectNextSong: "Valitse 'Seuraava Kappale' aloittaaksesi tai 'Aloita Peli'.",
      nextSongButton: "Seuraava Kappale",
      playSnippetButton: "Soita Pätkä",
      playMoreButton: "Soita 10s lisää",
      revealButton: "Paljasta Nimi",
      titleHidden: "(Nimi piilotettu)",
      revealedTitlePrefix: "Nimi:",
      playersTitle: "Pelaajat",
      score: "Pisteet",
      startGameButton: "Aloita Peli",
      restartGameButton: "Pelaa Uudelleen",
  };

  const [localDuration, setLocalDuration] = useState(0);
  const [localPlaybackTime, setLocalPlaybackTime] = useState(0);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false);

  const playerRef = useRef(null);
  const stopTimeoutRef = useRef(null);

  useEffect(() => {
    console.log(`Current song URL changed to: ${gameState?.currentSongUrl}. Resetting player state.`);
    setIsPlayerReady(false);
    setLocalDuration(0);
    setLocalPlaybackTime(0);
    setPendingAutoPlay(false);
    clearTimeout(stopTimeoutRef.current);
  }, [gameState?.currentSongUrl]);

  useEffect(() => {
    const timerId = stopTimeoutRef.current; // Keep track of previous timer
    clearTimeout(timerId); // Clear previous timer explicitly at the start
    console.log(`[TimerEffect] Running. State: ${gameState?.playbackState}, Ready: ${isPlayerReady}. Cleared timer ID: ${timerId}`); // Log effect run + clear

    const shouldBePlaying = gameState?.playbackState === 'playing_snippet' || gameState?.playbackState === 'playing_more';

    if (shouldBePlaying && playerRef.current && isPlayerReady) {
        const startTime = gameState.seekTime || 0;
        const player = playerRef.current; // Cache ref

        // Use a small delay before seeking, especially after becoming ready
        const seekDelay = 50; // ms
        const seekTimeoutId = setTimeout(() => {
            // Double-check player existence and readiness inside timeout
            if (!player || !player.getInternalPlayer()) {
               console.log(`[TimerEffect] Seek aborted (player disappeared before seek timeout)`);
               return;
            }
            const currentTime = player.getCurrentTime() || 0;
            if (Math.abs(currentTime - startTime) > 1.5) {
                console.log(`[TimerEffect] Seeking player to ${startTime.toFixed(1)}s (current: ${currentTime.toFixed(1)}) after delay`);
                player.seekTo(startTime, 'seconds');
            } else {
                console.log(`[TimerEffect] Player already near target seek time ${startTime.toFixed(1)}s (current: ${currentTime.toFixed(1)}). Not seeking.`);
            }
        }, seekDelay);

        console.log(`[TimerEffect] Setting stop timer for ${SNIPPET_DURATION}s because state is ${gameState.playbackState}`);
        const newStopTimerId = setTimeout(() => {
            console.log(`[TimerEffect] Stop timer FIRED (ID: ${newStopTimerId}). Requesting pause.`); // Log timer fire
            onUpdateRequest({ playbackState: 'paused' });
            stopTimeoutRef.current = null; // Clear ref after firing
        }, SNIPPET_DURATION * 1000);
        stopTimeoutRef.current = newStopTimerId; // Store new timer ID
        console.log(`[TimerEffect] Set new stop timer ID: ${newStopTimerId}`); // Log new timer ID

        // Return cleanup for *both* timeouts
        return () => {
            clearTimeout(seekTimeoutId); // Clear seek timeout
            clearTimeout(stopTimeoutRef.current); // Clear stop timeout
            console.log(`[TimerEffect] Cleanup: Cleared seek timer and stop timer ID: ${stopTimeoutRef.current}`); // Log cleanup
        };

    } else {
       console.log(`[TimerEffect] Conditions not met for playing/timer. State: ${gameState?.playbackState}, Ready: ${isPlayerReady}`);
        // No timer needed if not playing or not ready
       // Cleanup function when no timer is set
        return () => {
             console.log(`[TimerEffect] Cleanup: No timer was set.`); // Log cleanup when no timer was set
        };
    }

    // Add onUpdateRequest to dependencies as it's used inside
  }, [gameState?.playbackState, gameState?.seekTime, isPlayerReady, onUpdateRequest]); // Added onUpdateRequest

  useEffect(() => {
      // Check conditions *before* calling play
      if (pendingAutoPlay && isPlayerReady && localDuration >= SNIPPET_DURATION) {
          console.log(`Conditions met for pending auto play (ready: ${isPlayerReady}, duration: ${localDuration}). Calling handlePlaySnippet then onSnippetPlayed.`);
          handlePlaySnippet(); // Initiate playback request
          onSnippetPlayed(); // Signal that the auto-play snippet has been handled
          setPendingAutoPlay(false); // Reset the flag
      } else if (pendingAutoPlay) {
          // Optional: Log if auto-play is pending but conditions aren't met yet
          console.log(`Pending auto play but conditions not met (ready: ${isPlayerReady}, duration: ${localDuration})`);
      }
      // NOTE: Ensure handlePlaySnippet and onSnippetPlayed are stable or add them to dependency array if needed.
      // Assuming they are stable based on typical React patterns where functions from props don't change often
      // unless the parent component re-renders unnecessarily or they depend on parent state that changes.
      // If eslint complains, add them: [pendingAutoPlay, isPlayerReady, localDuration, handlePlaySnippet, onSnippetPlayed]
  }, [pendingAutoPlay, isPlayerReady, localDuration]); // Keep dependencies minimal for now

  const handleReady = () => {
       console.log('Local player Ready event for:', gameState?.currentSongUrl);
       if (playerRef.current && gameState?.currentSongUrl) {
           const dur = playerRef.current.getDuration();
            console.log(`Local player reported duration: ${dur}`);
            if (dur && dur > 0) {
                setLocalDuration(dur);
                setIsPlayerReady(true);
                 if (playFirstSnippet) {
                     console.log("playFirstSnippet flag is true. Setting pendingAutoPlay=true.");
                     setPendingAutoPlay(true);
                 }
            } else {
                console.warn(`Initial duration check failed (${dur}). Retrying in 1.5s...`);
                 setTimeout(() => {
                    if (!playerRef.current || playerRef.current.props.url !== gameState?.currentSongUrl) {
                        console.log("Retry aborted, song changed or player unmounted.");
                        return;
                    }
                    const checkDur = playerRef.current.getDuration();
                    console.log(`Local player retry duration check: ${checkDur}`);
                    if (checkDur && checkDur > 0) {
                        setLocalDuration(checkDur);
                        setIsPlayerReady(true);
                         if (playFirstSnippet) {
                             console.log("playFirstSnippet flag is true (on retry). Setting pendingAutoPlay=true.");
                             setPendingAutoPlay(true);
                         }
                    } else {
                        console.error('Could not get valid duration for this player after retry.');
                        onUpdateRequest({ error: "Failed to get video duration.", playbackState: 'error' });
                        setIsPlayerReady(false);
                    }
                }, 1500); 
            }
       } else {
            console.log('handleReady called but playerRef or currentSongUrl is missing');
             setIsPlayerReady(false);
       }
   };

   const handleError = (e) => {
       console.error('Local Player Error:', e, 'for URL:', gameState?.currentSongUrl);
       onUpdateRequest({ error: `Player error: ${e?.message || 'Unknown'}`, playbackState: 'error' });
       setIsPlayerReady(false);
       setLocalDuration(0);
   };

   const handleProgress = (state) => {
       if (isPlayerReady && gameState?.currentSongUrl) {
            setLocalPlaybackTime(state.playedSeconds);
       }
   };

  const handlePlaySnippet = () => {
      if (!gameState?.currentSongUrl || !isPlayerReady || !localDuration || localDuration < SNIPPET_DURATION) {
          console.warn(`Cannot play snippet (check inside handlePlaySnippet): No song, player not ready (${isPlayerReady}), or song too short (duration: ${localDuration}).`);
           if (pendingAutoPlay) {
               console.warn("Auto-play attempt failed conditions check, likely timing issue. Resetting pending flag.");
                setPendingAutoPlay(false);
                return;
           }
           onUpdateRequest({ error: "Cannot play snippet. Player not ready or video too short.", playbackState: 'error' });
           return;
      }
      // Ensure snippet doesn't start within the last END_BUFFER_SECONDS
      const maxSeek = Math.max(0, localDuration - SNIPPET_DURATION - END_BUFFER_SECONDS);
      // If maxSeek is 0 (song is too short for the buffer), randomSeek will also be 0.
      const randomSeek = Math.random() * maxSeek;
       console.log(`Requesting play snippet, seek: ${randomSeek.toFixed(1)} (duration: ${localDuration}, maxSeek: ${maxSeek.toFixed(1)})`);
      onUpdateRequest({
           playbackState: 'playing_snippet',
           seekTime: randomSeek,
           snippetPlayedOnce: true,
           error: null 
          });
  };

  const handlePlayMore = () => {
      if (!gameState?.currentSongUrl || !isPlayerReady || !localDuration || localDuration <= localPlaybackTime + 0.5) {
          console.warn(`Cannot play more: No song, player not ready, or already near end (duration: ${localDuration}, played: ${localPlaybackTime}).`);
          return;
      }
       console.log(`Requesting play more from ${localPlaybackTime.toFixed(1)}`);
      onUpdateRequest({ playbackState: 'playing_more', seekTime: localPlaybackTime, error: null });
  };

  const handleRevealTitle = () => {
       console.log("Requesting reveal title");
      onUpdateRequest({ playbackState: 'revealed' });
  };

  const handleSelectNextSong = () => {
       console.log("Requesting next song selection");
        clearTimeout(stopTimeoutRef.current);
       onUpdateRequest({ playbackState: 'paused' });
      onSelectNextSong();
  };

  const { currentSongUrl, currentSongTitle, playbackState, error, snippetPlayedOnce } = gameState || {};
  const isLoading = playbackState === 'loading';
  const isFinished = playbackState === 'finished';
  const isRevealed = playbackState === 'revealed';
  const isPlayerActuallyPlaying = playbackState === 'playing_snippet' || playbackState === 'playing_more';
  const canPlayMore = !isLoading && !isRevealed && playbackState === 'paused' && isPlayerReady && currentSongUrl != null && localDuration > localPlaybackTime + 0.5 && snippetPlayedOnce === true;
  const canPlaySnippet = !isLoading && !isRevealed && playbackState === 'paused' && isPlayerReady && currentSongUrl != null && localDuration >= SNIPPET_DURATION && !snippetPlayedOnce;
  const canReveal = !isLoading && !isRevealed && currentSongUrl != null;
  const canSelectNext = !isLoading && songs && songs.length > 0;

   const showStartGameButton = !isLoading && !currentSongUrl && !error && !isFinished && songs && songs.length > 0;

  const RestartIcon = t.restartGameIcon || FiRotateCw;

  // Lisätään logitus ennen renderöintiä
  console.log("[GameRoom Render] Relevant State:", {
      playbackState: gameState?.playbackState,
      snippetPlayedOnce: gameState?.snippetPlayedOnce,
      isPlayerReady,
      localDuration,
      canPlaySnippet, // Logataan laskettu arvo
      canPlayMore,     // Logataan laskettu arvo
      isPlayerActuallyPlaying // Log this value
  });

  return (
    <div className="game-room-container">
      <div className="section players-section">
        <h3>{t.playersTitle} <FiUsers /></h3>
        <PlayerList
            players={players}
            onUpdateScore={onUpdateScore}
            texts={{ scoreLabel: t.score }}
        />
      </div>

      <div className="section controls-section">
        <h3>{t.title}</h3>

        {currentSongUrl && (
          <ReactPlayer
            ref={playerRef}
            url={currentSongUrl}
            playing={isPlayerActuallyPlaying}
            onReady={handleReady}
            onEnded={() => {
                 console.log('Local onEnded event triggered.');
                 if (isPlayerActuallyPlaying) {
                    onUpdateRequest({ playbackState: 'paused' });
                 }
            }}
            onError={handleError}
            onProgress={handleProgress}
            width="1px"
            height="1px"
            style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
            config={{
              youtube: {
                playerVars: {
                    showinfo: 0,
                    controls: 0,
                    disablekb: 1,
                    modestbranding: 1,
                    playsinline: 1
                 }
              },
            }}
          />
        )}

        <div className="status-messages">
         {isLoading && <p className="loading-message"><FiLoader className="spin" /> {t.loading}</p>}
         {error && <p className="error-message"><FiAlertCircle /> {t.errorPrefix}: {error}</p>}
         {!currentSongUrl && !isLoading && !error && !isFinished && !showStartGameButton && songs && songs.length === 0 &&
            <p className="info-message">Lisää ensin kappaleita Asetukset-välilehdellä.</p>}
         {!currentSongUrl && !isLoading && !error && !isFinished && !showStartGameButton && songs && songs.length > 0 &&
            <p className="info-message">{t.selectNextSong}</p>}
         {isFinished && <p className="info-message">{currentSongTitle || 'Peli päättyi!'}</p>}
        </div>

        <div className="game-buttons">
            {showStartGameButton ? (
                 <button
                     onClick={onStartGame}
                     className="button start-game-button"
                 >
                     <FiPlayCircle /> {t.startGameButton}
                 </button>
            ) : isFinished ? (
                 <button
                     onClick={onRestartGame}
                     disabled={isLoading}
                     className="button restart-button"
                 >
                      <RestartIcon /> {t.restartGameButton}
                 </button>
            ) : (
                <>
                     <button
                         onClick={handleSelectNextSong}
                         disabled={!canSelectNext || isLoading}
                         className="button next-button"
                         title={songs && songs.length === 0 ? "Lisää ensin kappaleita" : "Valitse seuraava kappale"}
                     >
                         <FiSkipForward /> {t.nextSongButton}
                     </button>

                     <button
                         onClick={handlePlaySnippet}
                         disabled={!canPlaySnippet || isLoading || isPlayerActuallyPlaying}
                         className="button play-button"
                         title={!isPlayerReady ? "Soitin latautuu..." : !canPlaySnippet ? "Ei voi soittaa pätkää" : "Soita kappaleen pätkä" }
                     >
                         <FiPlay /> {t.playSnippetButton}
                     </button>

                     <button
                         onClick={handlePlayMore}
                         disabled={!canPlayMore || isLoading || isPlayerActuallyPlaying}
                         className="button play-more-button"
                         title={!isPlayerReady ? "Soitin latautuu..." : !canPlayMore ? "Ei voi soittaa lisää" : "Soita 10 sekuntia lisää"}
                     >
                         <FiChevronsRight /> {t.playMoreButton}
                     </button>

                     <button
                         onClick={handleRevealTitle}
                         disabled={!canReveal || isLoading}
                         className="button reveal-button"
                         title={!canReveal ? "Ei voi paljastaa" : "Paljasta kappaleen nimi"}
                     >
                         {isRevealed ? <FiEyeOff /> : <FiEye />} {t.revealButton}
                     </button>
                 </>
            )}
        </div>

        {currentSongUrl && (
            <div className="song-reveal">
            {isRevealed && currentSongTitle ? (
                <><FiEye /> {t.revealedTitlePrefix} <strong>{currentSongTitle}</strong></>
            ) : isFinished ? (
                 <><FiEyeOff /> {currentSongTitle || 'Peli päättyi!'}</>
             ) : (
                 <><FiEyeOff /> {t.titleHidden}</>
            )}
            </div>
        )}
      </div>

      <style jsx>{`
        .game-room-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .section {
            padding: 1rem;
            border: 1px solid #eee;
            border-radius: 8px;
            background-color: #f9f9f9;
        }

        h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          border-bottom: 1px solid #eee;
          padding-bottom: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          color: #333;
          font-size: 1.1rem;
        }

        .players-section h3 {
        }

        .controls-section {
        }

        .status-messages {
            margin-bottom: 1rem;
            min-height: 2.2em;
            display: flex;
            align-items: center;
        }
        .loading-message,
        .error-message,
        .info-message {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.8rem;
            border-radius: 4px;
            margin: 0;
            width: 100%;
        }
        .loading-message {
            color: #007bff;
            background-color: #e7f3ff;
        }
        .error-message {
            color: #dc3545;
            background-color: #f8d7da;
        }
        .info-message {
             color: #6c757d;
             background-color: #e2e3e5;
        }
        .spin {
            animation: spin 1.5s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .game-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

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
          font-size: 0.95rem;
          flex-grow: 1;
          text-align: center;
          white-space: nowrap;
        }
        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .start-game-button {
             background-color: #28a745;
             font-weight: bold;
             font-size: 1.1rem;
             width: 100%;
             justify-content: center;
        }
        .start-game-button:not(:disabled):hover {
             background-color: #218838;
        }

        .next-button {
          background-color: #6c757d;
        }
        .next-button:not(:disabled):hover {
          background-color: #5a6268;
        }

        .play-button {
          background-color: #007bff;
        }
        .play-button:not(:disabled):hover {
          background-color: #0056b3;
        }

        .play-more-button {
          background-color: #ffc107;
          color: #333;
        }
        .play-more-button:not(:disabled):hover {
           background-color: #e0a800;
        }

        .reveal-button {
          background-color: #17a2b8;
        }
         .reveal-button:not(:disabled):hover {
          background-color: #138496;
        }

        .restart-button {
             background-color: #ffc107;
             color: #333;
             font-weight: bold;
             width: 100%;
             justify-content: center;
        }
        .restart-button:not(:disabled):hover {
            background-color: #e0a800;
        }

        .song-reveal {
          margin-top: 1rem;
          padding: 0.8rem 1rem;
          border: 1px dashed #ccc;
          border-radius: 4px;
          background-color: #e9ecef;
          color: #495057;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 2.5em;
          text-align: center;
        }
        .song-reveal strong {
            color: #000;
        }

      `}</style>
    </div>
  );
}

export default GameRoom;