// src/components/SongSetup.js
import React, { useState, useEffect, useCallback } from 'react';
import {
    FiLink, FiPlusCircle, FiMusic, FiTrash2, FiUser, FiUserPlus, FiUsers,
    FiAlertCircle, FiSearch, FiLoader
} from 'react-icons/fi';

// Helper debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function SongSetup({ songs, onAddSong, onDeleteSong, players, onAddPlayer, onDeletePlayer, texts }) {
  // State for adding songs via search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addSongError, setAddSongError] = useState(''); // Separate error state for adding
  const [isAddingSong, setIsAddingSong] = useState(false); // State for adding a specific song

  // State for adding players
  const [playerName, setPlayerName] = useState('');

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term) => {
      if (!term.trim() || term.length < 3) { // Search only if term is long enough
        setSearchResults([]);
        setIsSearching(false);
        setSearchError('');
        return;
      }
      console.log('Starting search for:', term);
      setIsSearching(true);
      setSearchError('');
      try {
        const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(term)}`);

        // Check if response is ok and content type is json before parsing
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          setSearchResults(data);
          console.log('Search results:', data);
        } else {
          // Handle non-JSON responses (likely errors sent as text)
          let errorMsg = texts?.searchErrorDefault || 'Haku epäonnistui';
          const errorText = await response.text(); // Read error as text
           if (response.status === 429) {
               errorMsg = texts?.searchQuotaError || 'Hakukiintiö ylittyi. Yritä myöhemmin uudelleen.';
           } else if (errorText) {
               errorMsg = `${texts?.searchErrorPrefix || 'Virhe'} (${response.status}): ${errorText}`;
           } else {
               errorMsg = `${texts?.searchErrorPrefix || 'Virhe'}: ${response.statusText} (Status ${response.status})`;
           }
           console.error('Non-JSON response received from backend:', errorMsg);
           throw new Error(errorMsg);
        }
      } catch (err) {
        console.error('YouTube Search Error or Fetch Error:', err);
        setSearchError(err.message);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500), // Debounce search by 500ms
    [texts] // Include texts in dependencies if they might change
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const handleAddPlayerSubmit = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onAddPlayer(playerName);
    setPlayerName('');
  };

  const handleAddSongFromSearch = async (song) => {
    console.log('Attempting to add song:', song);
    setIsAddingSong(true);
    setAddSongError('');
    try {
        // Call the backend endpoint to add the song
        const response = await fetch('/api/add-song', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: song.title, url: song.url }),
        });

        if (!response.ok) {
            let errorMsg = texts?.addSongErrorDefault || 'Kappaleen lisääminen epäonnistui';
             try {
                 const errorText = await response.text();
                 if (response.status === 409) {
                    errorMsg = texts?.addSongDuplicateError || 'Kappale tällä URL:lla on jo lisätty.';
                 } else {
                     errorMsg = `${texts?.addSongErrorPrefix || 'Lisäysvirhe'}: ${errorText || response.statusText}`;
                 }
             } catch (e) { /* Ignore */ }
            throw new Error(errorMsg);
        }

        const addedSong = await response.json();
        console.log('Successfully added song:', addedSong);
        // Optionally call onAddSong prop if it needs to update parent state differently
        // onAddSong(addedSong); // This might not be needed if parent refetches songs

        // Clear search after successful addition
        setSearchTerm('');
        setSearchResults([]);
        setSearchError('');
    } catch (err) {
      console.error("Error adding song:", err);
      setAddSongError(err.message);
    } finally {
      setIsAddingSong(false);
    }
  };

  return (
    <div className="song-setup-container">
      <h2>{texts?.songSetupTitle || 'Pelin Asetukset'}</h2>

      {/* Kappaleiden hallinta */}
      <div className="section songs-section">
        <h3>{texts?.manageSongsTitle || 'Hallinnoi kappaleita'}</h3>

        {/* --- YouTube Search Input --- */}
        <div className="add-item-form youtube-search-form">
          <div className="input-container with-icon">
            <FiSearch className="input-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={texts?.youtubeSearchPlaceholder || 'Hae kappaletta YouTubesta...'}
              disabled={isAddingSong} // Disable while adding a song
              aria-label={texts?.youtubeSearchPlaceholder || 'Hae YouTubesta'}
            />
             {isSearching && <FiLoader className="spinner input-spinner" />} 
          </div>
        </div>

        {/* --- Search Status Messages --- */}
         {searchError && !isSearching && <p className="error-message"><FiAlertCircle /> {searchError}</p>}
         {addSongError && <p className="error-message"><FiAlertCircle /> {addSongError}</p>}

        {/* --- Search Results --- */}
        {searchResults.length > 0 && (
          <ul className="search-results-list">
             <h4>{texts?.searchResultsTitle || 'Hakutulokset:'}</h4>
            {searchResults.map((result) => (
              <li key={result.videoId}>
                 <img src={result.thumbnail} alt="Thumbnail" className="search-result-thumbnail"/>
                <span className="search-result-title" title={result.title}>{result.title}</span>
                <button
                  onClick={() => handleAddSongFromSearch(result)}
                  className="button add-result-button"
                  disabled={isAddingSong}
                  aria-label={texts?.addSongButton || 'Lisää kappale'}
                >
                  <FiPlusCircle />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* --- Existing Song List --- */}
        <h3>{texts?.songListTitle || 'Lisätyt kappaleet'} ({songs.length}) <FiMusic /></h3>
         <ul className="item-list song-list">
           {songs.length === 0 ? (
            <li className="empty-list-message">{texts?.noSongsAdded || 'Ei kappaleita lisätty vielä.'}</li>
           ) : (
             songs.map((song) => (
              <li key={song.id}>
                <FiMusic style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                {song.title}
                <button
                  onClick={() => onDeleteSong(song.id)}
                  className="delete-button"
                  aria-label={texts?.deleteSongButton || 'Poista kappale'}
                >
                  <FiTrash2 />
                </button>
              </li>
            ))
           )}
         </ul>
      </div>

      {/* Pelaajien hallinta */}
      <div className="section players-section">
        <h3>{texts?.managePlayersTitle || 'Hallinnoi pelaajia'}</h3>
        <form onSubmit={handleAddPlayerSubmit} className="add-item-form">
          <div className="input-container with-icon">
            <FiUser className="input-icon" />
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={texts?.playerNamePlaceholder || 'Pelaajan nimi'}
              required
            />
          </div>
          <button type="submit" className="button add-player-button" disabled={!playerName.trim()}>
            <FiUserPlus />
            {texts?.addPlayerButton || 'Lisää pelaaja'}
          </button>
        </form>

        <h3>{texts?.playerListTitle || 'Pelaajien lista'} ({players.length}) <FiUsers /></h3>
        <ul className="item-list">
           {players.length === 0 ? (
            <li className="empty-list-message">{texts?.noPlayersAdded || 'Ei pelaajia lisätty vielä.'}</li>
           ) : (
            players.map(player => (
            <li key={player.id}>
              <span>
                <FiUser style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                {player.name}
              </span>
              <button
                onClick={() => onDeletePlayer(player.id)}
                className="delete-button"
                aria-label={texts?.deletePlayerButton || 'Poista pelaaja'}
                >
                <FiTrash2 />
              </button>
            </li>
          )))
          }
        </ul>
      </div>

      {/* JSX Styles */}
      <style jsx>{`
        .song-setup-container {
          padding: 1rem;
          border: 1px solid #eee;
          border-radius: 8px;
          background-color: #f9f9f9;
          margin-bottom: 1rem;
        }
        .section {
            margin-bottom: 2rem;
        }
        .section:last-child {
            margin-bottom: 0;
        }
        .add-item-form {
          display: flex;
          align-items: stretch;
          margin-bottom: 1rem;
          gap: 0.5rem;
        }
        .input-container.with-icon {
          position: relative;
          flex-grow: 1;
        }
        .input-container input {
          padding: 0.6rem;
          padding-left: 2.2rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          width: 100%;
          box-sizing: border-box;
          height: 100%;
        }
        .input-icon {
          position: absolute;
          left: 0.7rem;
          top: 50%;
          transform: translateY(-50%);
          color: #888;
        }

        .button {
          padding: 0.6rem 1rem;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: background-color 0.2s ease, opacity 0.2s ease;
          font-size: 0.9rem;
          white-space: nowrap;
        }

        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .button.add-song-button {
             background-color: #28a745;
        }
         .button.add-song-button:not(:disabled):hover {
             background-color: #218838;
         }

        .button.add-player-button {
             background-color: #007bff;
        }
         .button.add-player-button:not(:disabled):hover {
             background-color: #0056b3;
         }

        .error-message {
          color: #dc3545;
          background-color: #f8d7da;
          padding: 0.5rem 0.8rem;
          border-radius: 4px;
          margin-top: -0.5rem;
          margin-bottom: 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          width: 100%;
          box-sizing: border-box;
        }
        h3 {
          margin-top: 1.5rem;
          margin-bottom: 0.8rem;
          border-bottom: 1px solid #eee;
          padding-bottom: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          color: #333;
          font-size: 1.1rem;
        }
        .item-list {
          list-style: none;
          padding: 0;
          margin-top: 0.5rem;
        }
         .item-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 0.4rem;
          border-bottom: 1px solid #f0f0f0;
          background-color: #fff;
          margin-bottom: 0.3rem;
          border-radius: 4px;
        }
         .item-list li span {
           display: flex;
           align-items: center;
         }
         .item-list li:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .item-list li.empty-list-message {
            padding: 1rem;
            justify-content: center;
            color: #666;
            background-color: #f8f9fa;
            border: 1px dashed #ddd;
        }
        .delete-button {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          padding: 0.2rem 0.4rem;
          font-size: 1.2rem;
          line-height: 1;
          transition: color 0.2s ease, background-color 0.2s ease;
          border-radius: 4px;
        }
        .delete-button:hover {
          color: #a71d2a;
          background-color: #f8d7da;
        }

        .search-results-list {
            list-style: none;
            padding: 0;
            margin-top: 1rem;
            margin-bottom: 1.5rem;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            max-height: 300px; /* Limit height and make scrollable */
            overflow-y: auto;
            background-color: #fff;
        }
         .search-results-list h4 {
            margin: 0;
             padding: 0.6rem 0.8rem;
             background-color: #f8f9fa;
             border-bottom: 1px solid #e0e0e0;
             font-size: 0.9rem;
             color: #555;
             position: sticky;
             top: 0;
             z-index: 1;
        }
        .search-results-list li {
            display: flex;
            align-items: center;
            padding: 0.5rem 0.8rem;
            border-bottom: 1px solid #eee;
            gap: 0.8rem;
        }
        .search-results-list li:last-child {
            border-bottom: none;
        }
        .search-result-thumbnail {
             width: 40px;
             height: 30px; /* Maintain aspect ratio */
             object-fit: cover;
             border-radius: 2px;
             flex-shrink: 0;
        }
        .search-result-title {
            flex-grow: 1;
            font-size: 0.9rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .button.add-result-button {
             padding: 0.4rem 0.6rem;
             font-size: 0.8rem;
             background-color: #28a745;
             flex-shrink: 0;
        }
         .button.add-result-button:not(:disabled):hover {
             background-color: #218838;
         }
      `}</style>
    </div>
  );
}

export default SongSetup;