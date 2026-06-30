function parseSongInfo(rawTitle) {
    let songTitle = rawTitle;
    let artist = '';
    
    let cleanTitle = rawTitle
        .replace(/^\s*\[MV\]\s*/gi, '')
        .replace(/^\s*\[Official.*?\]\s*/gi, '')
        .replace(/^\s*\(Official.*?\)\s*/gi, '')
        .replace(/\s*Official\s+(Music\s+)?Video/gi, '')
        .replace(/\s*MV\s*$/gi, '')
        .replace(/\s*M\/V\s*$/gi, '')
        .trim();
    
    const patterns = [
        /^(.+?)\s*_\s*(.+?)$/,
        /^(.+?)\s*-\s*(.+?)$/,
        /^(.+?)\s*by\s+(.+?)$/i,
        /^(.+?)\s*\|\s*(.+?)$/,
        /^(.+?)\s*・\s*(.+?)$/,
        /(.+?)\s*『(.+?)』/,
        /^(.+?)\s+["'](.+?)["']$/
    ];
    
    for (const pattern of patterns) {
        const match = cleanTitle.match(pattern);
        if (match) {
            artist = match[1].trim();
            songTitle = match[2].trim();
            
            artist = artist.replace(/\s*\([^)]*\)/g, '').trim();
            artist = artist.replace(/\s*\[[^\]]*\]/g, '').trim();
            artist = artist.replace(/\s*【[^】]*】/g, '').trim();
            
            songTitle = songTitle.replace(/\s*\([^)]*\)/g, '').trim();
            songTitle = songTitle.replace(/\s*\[[^\]]*\]/g, '').trim();
            songTitle = songTitle.replace(/\s*【[^】]*】/g, '').trim();
            songTitle = songTitle.replace(/\s*Lyrics?$/gi, '').trim();
            songTitle = songTitle.replace(/\s*Audio$/gi, '').trim();
            
            break;
        }
    }
    
    if (!artist) {
        artist = cleanTitle;
        songTitle = cleanTitle;
    }
    
    return { songTitle, artist };
}

/**
 * Check if a text string is noise/garbage that should not be treated as music metadata.
 * Returns true for empty strings, pure numbers, section headers, shop text, etc.
 */
function isNoiseText(text) {
    if (!text || typeof text !== 'string') return true;
    const trimmed = text.trim();
    if (trimmed.length === 0) return true;
    
    // Pure numbers
    if (/^\d+$/.test(trimmed)) return true;
    
    // Section headers (Music / Música in various languages)
    if (/^(music|m[uú]sica)$/i.test(trimmed)) return true;
    
    // Numbered track patterns — with accent fix: canción, canciones, song, songs, track, tracks, tema, temas
    if (/^\d+\s+(canc[iíó]ón?|song|track|tema)s?$/i.test(trimmed)) return true;
    
    // YouTube Shorts patterns
    if (/^(shorts|[\d,.]+\s*k?\s*shorts)$/i.test(trimmed)) return true;
    
    // Pure symbols / punctuation only
    if (/^[\s•·\-–—_|★☆♪♫♬🎵🎶▶️]+$/.test(trimmed)) return true;
    
    // Product / shopping text (Spanish / English)
    if (/^(bu(y|s) (now|here)|link (in (description|bio)|en la descripci[óo]n)|sponsored|ad|promo(ci[óo]n)?|available\s+at|compra\s+ahora|enlace|lleva (a|al) (mercadillo|producto)|m[aá]s\s+informaci[óo]n|etiquetado|productos|aparecen\s+m[aá]s\s+abajo|mira\s+los\s+productos)$/i.test(trimmed)) return true;
    
    // Embedded product indicators — text containing 2+ shop-related words is likely product noise
    const shopWordCount = (trimmed.match(/\b(etiquetado|productos?|compra|shop(ping)?|sponsored|ad|promo|c[óo]mpral[oa]|enlace|informaci[óo]n|aparecen|abajo|tagged|products?)\b/i) || []).length;
    if (shopWordCount >= 2 && trimmed.length > 60) return true;
    
    // Unreasonably long text — song titles are rarely > 150 chars
    if (trimmed.length > 200) return true;
    
    return false;
}

/**
 * Validate that extracted music metadata looks like real song/artist data.
 * Prevents garbage from overriding correct title-parsed values.
 */
function isValidMusicMetadata(data) {
    if (!data) return false;
    if (data.songTitle == null || data.artist == null) return false;
    if (typeof data.songTitle !== 'string' || typeof data.artist !== 'string') return false;
    
    const title = data.songTitle.trim();
    const artist = data.artist.trim();
    
    if (title.length === 0 || artist.length === 0) return false;
    if (isNoiseText(title) || isNoiseText(artist)) return false;
    
    // Must contain at least one Unicode letter character (supports all scripts: Latin, Hangul, Kana, etc.)
    if (!/\p{L}/u.test(title) || !/\p{L}/u.test(artist)) return false;
    
    return true;
}

/**
 * Try to get music metadata from the browser's Media Session API.
 * This is set natively by YouTube/YouTube Music and is the most reliable source.
 * No DOM dependency — works even if YouTube changes their page structure.
 */
function getMediaSessionMetadata() {
    try {
        if (navigator.mediaSession && navigator.mediaSession.metadata) {
            const metadata = navigator.mediaSession.metadata;
            const title = metadata.title || null;
            const artist = metadata.artist || null;
            
            if (title && artist) {
                const result = {
                    songTitle: title.trim(),
                    artist: artist.trim(),
                    album: metadata.album ? metadata.album.trim() : null,
                    albumCover: null,
                    source: 'mediasession',
                    isComplete: true
                };
                
                if (isValidMusicMetadata(result)) {
                    return result;
                }
            }
        }
    } catch (e) {
        // MediaSession API not available — silently continue
    }
    return null;
}

function getPlaylistInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('list');
    
    if (!playlistId) return null;
    
    const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer');
    const items = [];
    let minIndex = Infinity;
    let maxIndex = -Infinity;
    
    playlistItems.forEach((item, domIndex) => {
        const titleEl = item.querySelector('#video-title');
        const linkEl = item.querySelector('a#wc-endpoint');
        const videoId = linkEl?.href?.match(/v=([^&]+)/)?.[1];
        const isCurrent = item.hasAttribute('selected');
        const indexEl = item.querySelector('#index');
        const playlistIndex = indexEl ? parseInt(indexEl.textContent.trim()) - 1 : domIndex;
        
        if (playlistIndex < minIndex) minIndex = playlistIndex;
        if (playlistIndex > maxIndex) maxIndex = playlistIndex;
        
        if (titleEl && videoId) {
            items.push({
                index: playlistIndex,
                videoId: videoId,
                title: titleEl.textContent.trim(),
                url: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`,
                playlistId: playlistId,
                isCurrent: isCurrent
            });
        }
    });
    
    return {
        playlistId: playlistId,
        items: items,
        count: items.length
    };
}

function extractMusicMetadataFromDescription() {
    try {
        const descriptionContainer = document.querySelector('ytd-watch-metadata #description-inline-expander');
        if (!descriptionContainer) {
            return null;
        }

        const descriptionText = descriptionContainer.textContent;
        
        const musicSection = descriptionContainer.querySelector('ytd-structured-description-content-renderer');
        if (musicSection) {
            const musicCarousel = musicSection.querySelector('ytd-horizontal-card-list-renderer');
            if (musicCarousel) {
                const videoAttributeCard = musicCarousel.querySelector('yt-video-attribute-view-model');
                if (videoAttributeCard) {
                    const titleEl = videoAttributeCard.querySelector('h1.yt-video-attribute-view-model__title');
                    const subtitleEl = videoAttributeCard.querySelector('h4.yt-video-attribute-view-model__subtitle');
                    const secondarySubtitle = videoAttributeCard.querySelector('.yt-video-attribute-view-model__secondary-subtitle .yt-core-attributed-string');
                    
                    let albumCoverImg = videoAttributeCard.querySelector('img');
                    
                    if (!albumCoverImg || !albumCoverImg.src) {
                        albumCoverImg = musicSection.querySelector('img[src*="googleusercontent"], img[src*="ytimg"]');
                    }
                    
                    const songTitle = titleEl?.textContent?.trim();
                    const artist = subtitleEl?.textContent?.trim();
                    const rawAlbum = secondarySubtitle?.textContent?.trim();
                    
                    let album = null;
                    if (rawAlbum && rawAlbum.length > 0) {
                        album = rawAlbum
                            .replace(/^\[/, '')
                            .replace(/\]$/, '')
                            .replace(/^The\s+\d+\w*\s+(Mini\s+)?Album\s+[:'"-]*/i, '')
                            .replace(/\s+-\s+The\s+\d+\w*\s+(Mini\s+)?Album$/i, '')
                            .replace(/[:'"]$/g, '')
                            .replace(/^EP\s+[:'"]*/i, '')
                            .trim();
                    }
                    
                    let albumCover = null;
                    if (albumCoverImg) {
                        albumCover = albumCoverImg.src || 
                                    albumCoverImg.getAttribute('data-src') ||
                                    albumCoverImg.getAttribute('data-thumb-url');
                        
                        if (!albumCover || albumCover === '') {
                            const bgImage = window.getComputedStyle(albumCoverImg.parentElement || albumCoverImg).backgroundImage;
                            if (bgImage && bgImage !== 'none') {
                                const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
                                if (match) {
                                    albumCover = match[1];
                                }
                            }
                        }
                    }

                    if (songTitle && artist) {
                        return {
                            songTitle: songTitle,
                            artist: artist,
                            album: album,
                            albumCover: albumCover,
                            source: 'description',
                            isComplete: true
                        };
                    }
                }
                
                const firstCard = musicCarousel.querySelector('ytd-compact-station-renderer');
                if (firstCard) {
                    const songLink = firstCard.querySelector('#video-title');
                    const metadata = firstCard.querySelectorAll('yt-formatted-string.ytd-compact-station-renderer');
                    const albumCoverImg = firstCard.querySelector('img');
                    
                    const songTitle = songLink?.textContent?.trim();
                    const artist = metadata[0]?.textContent?.trim();
                    const rawAlbum = metadata[1]?.textContent?.trim();
                    
                    let album = null;
                    if (rawAlbum && rawAlbum.length > 0) {
                        album = rawAlbum
                            .replace(/^\[/, '')
                            .replace(/\]$/, '')
                            .replace(/^The\s+\d+\w*\s+(Mini\s+)?Album\s+[:'"]*/i, '')
                            .replace(/[:'"]$/g, '')
                            .replace(/^EP\s+[:'"]*/i, '')
                            .trim();
                    }
                    
                    const albumCover = albumCoverImg ? albumCoverImg.src : null;

                    if (songTitle && artist) {
                        return {
                            songTitle: songTitle,
                            artist: artist,
                            album: album,
                            albumCover: albumCover,
                            source: 'description',
                            isComplete: true
                        };
                    }
                }
                
                const lockupCard = musicCarousel.querySelector('ytd-lockup-view-model');
                if (lockupCard) {
                    const contentNode = lockupCard.querySelector('yt-lockup-metadata-view-model');
                    if (contentNode) {
                        const titleEl = contentNode.querySelector('h3');
                        const metadataEls = contentNode.querySelectorAll('.yt-core-attributed-string');
                        const albumCoverImg = lockupCard.querySelector('img');
                        
                        const songTitle = titleEl?.textContent?.trim();
                        const artist = metadataEls[0]?.textContent?.trim();
                        const rawAlbum = metadataEls[1]?.textContent?.trim();
                        
                        let album = null;
                        if (rawAlbum && rawAlbum.length > 0) {
                            album = rawAlbum
                                .replace(/^\[/, '')
                                .replace(/\]$/, '')
                                .replace(/^The\s+\d+\w*\s+(Mini\s+)?Album\s+[:'"]*/i, '')
                                .replace(/[:'"]$/g, '')
                                .replace(/^EP\s+[:'"]*/i, '')
                                .trim();
                        }
                        
                        const albumCover = albumCoverImg ? albumCoverImg.src : null;

                        
                        if (songTitle && artist) {
                            return {
                                songTitle: songTitle,
                                artist: artist,
                                album: album,
                                albumCover: albumCover,
                                source: 'description',
                                isComplete: true
                            };
                        }
                    }
                }
            }
            
            const musicLink = musicSection.querySelector('a[href*="music.youtube.com"]');
            
            // Direct children of the music section may include product/shopping text.
            // Scope text extraction to the horizontal card list if available.
            const textScope = musicCarousel || musicSection;
            const allTextElements = textScope.querySelectorAll('yt-formatted-string');
            const textArray = Array.from(allTextElements).map(el => el.textContent.trim());
            
            const filteredText = textArray.filter(text =>
                text.length > 0 && !isNoiseText(text)
            );
            

            let songTitle = null;
            let artist = null;
            let album = null;
            
            if (musicLink) {
                const linkText = musicLink.textContent.trim();
                if (!isNoiseText(linkText)) {
                    songTitle = linkText;
                }
            }
            
            if (!songTitle && filteredText.length > 0) {
                songTitle = filteredText[0];
            }
            
            if (filteredText.length > 1) {
                const potentialArtist = filteredText[1];
                if (!isNoiseText(potentialArtist)) {
                    artist = potentialArtist;
                }
            }
            
            if (filteredText.length > 2) {
                const possibleAlbum = filteredText[2];
                if (possibleAlbum && possibleAlbum.length > 0 && !isNoiseText(possibleAlbum)) {
                    album = possibleAlbum
                        .replace(/^\[/, '')
                        .replace(/\]$/, '')
                        .replace(/^The\s+\d+\w*\s+(Mini\s+)?Album\s+[:'"]*/i, '')
                        .replace(/[:'"]$/g, '')
                        .replace(/^EP\s+[:'"]*/i, '')
                        .trim();
                }
            }
            
            const albumCoverImg = musicSection.querySelector('img');
            const albumCover = albumCoverImg ? albumCoverImg.src : null;
            

            if (songTitle && artist) {
                return {
                    songTitle: songTitle,
                    artist: artist,
                    album: album,
                    albumCover: albumCover,
                    source: 'description',
                    isComplete: true
                };
            } else {
                return null;
            }
        }
        
        const lines = descriptionText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        const musicaIndex = lines.findIndex(line => line.match(/^Música$/i) || line.match(/^Music$/i));
        if (musicaIndex !== -1) {
            const afterMusica = lines.slice(musicaIndex + 1);
            
            const validLines = afterMusica.filter(line => 
                line.length > 0 && !isNoiseText(line)
            );
            

            if (validLines.length >= 2) {
                const potentialSong = validLines[0];
                const potentialArtist = validLines[1];
                const potentialAlbum = validLines[2];
                
                if (potentialSong && potentialArtist) {
                    let album = null;
                    if (potentialAlbum && potentialAlbum.length > 0) {
                        album = potentialAlbum
                            .replace(/^\[/, '')
                            .replace(/\]$/, '')
                            .replace(/^The\s+\d+\w*\s+(Mini\s+)?Album\s+[:'"]*/i, '')
                            .replace(/[:'"]$/g, '')
                            .trim();
                    }
                    
                    const albumCoverImg = musicSection?.querySelector('img');
                    const albumCover = albumCoverImg ? albumCoverImg.src : null;
                    

                    return {
                        songTitle: potentialSong,
                        artist: potentialArtist,
                        album: album,
                        albumCover: albumCover,
                        source: 'description-text',
                        isComplete: true
                    };
                }
            }
        }
        
        const musicRegex = /(?:Song|Track|Title|Canción)\s*[:：]\s*([^\n]+)|(?:Artist|Artista|アーティスト)\s*[:：]\s*([^\n]+)|(?:Album|Álbum|アルバム)\s*[:：]\s*([^\n]+)/gi;
        let match;
        let metadata = {};
        
        while ((match = musicRegex.exec(descriptionText)) !== null) {
            if (match[1] && !metadata.songTitle) metadata.songTitle = match[1].trim();
            if (match[2] && !metadata.artist) metadata.artist = match[2].trim();
            if (match[3] && !metadata.album) metadata.album = match[3].trim();
        }
        
        if (metadata.songTitle && metadata.artist) {
            return { ...metadata, source: 'description-regex', isComplete: true };
        }
        
    } catch (error) {
        console.log('Error extracting music metadata:', error);
    }
    
    return null;
}

function getYouTubeVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title.style-scope.ytd-video-primary-info-renderer, yt-formatted-string.style-scope.ytd-watch-metadata');
    const rawTitle = titleElement ? titleElement.textContent.trim() : document.title.replace(' - YouTube', '');
    
    let { songTitle, artist } = parseSongInfo(rawTitle);
    let album = null;
    let albumCover = null;
    let videoThumbnail = null;
    let metadataSource = 'title-parsing';
    
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (videoId) {
        videoThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    } else {
        const linkTag = document.querySelector('link[rel="image_src"]');
        if (linkTag) {
            videoThumbnail = linkTag.href;
        } else {
            const thumbnailMeta = document.querySelector('meta[property="og:image"]');
            if (thumbnailMeta) {
                videoThumbnail = thumbnailMeta.content;
            }
        }
    }
    
    // Priority 1: navigator.mediaSession.metadata (most reliable, no DOM dependency)
    const mediaSessionMetadata = getMediaSessionMetadata();
    if (mediaSessionMetadata && isValidMusicMetadata(mediaSessionMetadata)) {
        songTitle = mediaSessionMetadata.songTitle;
        artist = mediaSessionMetadata.artist;
        album = mediaSessionMetadata.album || null;
        albumCover = mediaSessionMetadata.albumCover || null;
        metadataSource = 'mediasession';
        console.log(`MediaSession metadata: "${songTitle}" by "${artist}"` + (album ? ` (${album})` : ''));
    } else {
        // Priority 2: Description DOM scraping (with validation)
        const descriptionMetadata = extractMusicMetadataFromDescription();
        if (descriptionMetadata && descriptionMetadata.isComplete) {
            if (isValidMusicMetadata(descriptionMetadata)) {
                songTitle = descriptionMetadata.songTitle;
                artist = descriptionMetadata.artist;
                album = descriptionMetadata.album || null;
                albumCover = descriptionMetadata.albumCover || null;
                metadataSource = descriptionMetadata.source;
                console.log(`Description metadata: "${songTitle}" by "${artist}"` + (album ? ` (${album})` : '') + ` [source: ${metadataSource}]`);
            } else {
                console.log(`Description metadata REJECTED (invalid): "${descriptionMetadata.songTitle}" / "${descriptionMetadata.artist}" — falling back to title parsing`);
            }
        } else {
            console.log('No description metadata found, using title parsing');
        }
    }

    // Final safety net: if song/artist still look like garbage, fall back to raw title
    if (!songTitle || !artist || songTitle.length === 0 || artist.length === 0 || isNoiseText(songTitle) || isNoiseText(artist)) {
        console.log(`Final validation rejected: "${songTitle}" / "${artist}" — using raw title`);
        songTitle = rawTitle;
        artist = '';
        metadataSource = 'raw-title';
    }

    const playlist = getPlaylistInfo();

    return {
        title: rawTitle,
        songTitle: songTitle,
        artist: artist,
        album: album,
        thumbnail: videoThumbnail,
        albumCover: albumCover,
        videoThumbnail: videoThumbnail,
        metadataSource: metadataSource,
        currentTime: video.currentTime,
        duration: video.duration,
        progress: video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0,
        playing: !video.paused,
        url: window.location.href,
        site: 'YouTube',
        playlist: playlist
    };
}

function getVimeoVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const titleElement = document.querySelector('.player-title');
    const title = titleElement ? titleElement.textContent.trim() : document.title.replace(' on Vimeo', '');

    return {
        title: title,
        thumbnail: '',
        currentTime: video.currentTime,
        duration: video.duration,
        progress: video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0,
        playing: !video.paused,
        url: window.location.href,
        site: 'Vimeo'
    };
}

function getGenericVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const thumbnailMeta = document.querySelector('meta[property="og:image"]');
    
    return {
        title: document.title,
        thumbnail: thumbnailMeta ? thumbnailMeta.content : '',
        currentTime: video.currentTime,
        duration: video.duration,
        progress: video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0,
        playing: !video.paused,
        url: window.location.href,
        site: 'Generic'
    };
}

function getVideoInfo() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('youtube.com')) {
        return getYouTubeVideoInfo();
    } else if (hostname.includes('vimeo.com')) {
        return getVimeoVideoInfo();
    } else {
        return getGenericVideoInfo();
    }
}
