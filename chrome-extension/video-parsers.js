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
    
    console.log(`👀 Visible in DOM: ${items.length} items (indices ${minIndex === Infinity ? '?' : minIndex+1} to ${maxIndex === -Infinity ? '?' : maxIndex+1})`);
    
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
            console.log('📝 No description container found');
            return null;
        }

        const descriptionText = descriptionContainer.textContent;
        
        const musicSection = descriptionContainer.querySelector('ytd-structured-description-content-renderer');
        if (musicSection) {
            console.log('🎵 Found music section in description');
            
            const musicCarousel = musicSection.querySelector('ytd-horizontal-card-list-renderer');
            if (musicCarousel) {
                console.log('🔍 Found music carousel');
                
                const videoAttributeCard = musicCarousel.querySelector('yt-video-attribute-view-model');
                if (videoAttributeCard) {
                    console.log('🔍 Found video attribute view model');
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
                    
                    console.log('🔍 Debug: Found video attribute card:', {
                        songTitle,
                        artist,
                        album,
                        hasAlbumCover: !!albumCover
                    });
                    
                    if (songTitle && artist) {
                        console.log('✅ Music metadata extracted successfully from video attribute card');
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
                    console.log('🔍 Found compact station card');
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
                    
                    console.log('🔍 Debug: Found music card:', {
                        songTitle,
                        artist,
                        album,
                        hasAlbumCover: !!albumCover
                    });
                    
                    if (songTitle && artist) {
                        console.log('✅ Music metadata extracted successfully from card');
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
                    console.log('🔍 Found lockup view model card');
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
                        
                        console.log('🔍 Debug: Found lockup card:', {
                            songTitle,
                            artist,
                            album,
                            hasAlbumCover: !!albumCover
                        });
                        
                        if (songTitle && artist) {
                            console.log('✅ Music metadata extracted successfully from lockup');
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
            const allTextElements = musicSection.querySelectorAll('yt-formatted-string');
            const textArray = Array.from(allTextElements).map(el => el.textContent.trim());
            
            console.log('🔍 Debug: Text elements found:', {
                count: textArray.length,
                elements: textArray
            });
            
            const filteredText = textArray.filter(text => 
                text.length > 0 && 
                !text.match(/^Música$/i) && 
                !text.match(/^Music$/i) &&
                !text.match(/^\d+\s+(cancion|song|track)/i) &&
                !text.match(/^Shorts/i) &&
                !text.match(/^[\d,\.]+\s*K?\s*Shorts$/i)
            );
            
            console.log('🔍 Debug: Filtered elements:', filteredText);
            
            let songTitle = null;
            let artist = null;
            let album = null;
            
            if (musicLink) {
                songTitle = musicLink.textContent.trim();
            }
            
            if (!songTitle && filteredText.length > 0) {
                songTitle = filteredText[0];
            }
            
            if (filteredText.length > 1) {
                artist = filteredText[1];
            }
            
            if (filteredText.length > 2) {
                const possibleAlbum = filteredText[2];
                if (possibleAlbum && possibleAlbum.length > 0) {
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
            
            console.log('🔍 Extracted:', { songTitle, artist, album, albumCover: albumCover?.substring(0, 50) });
            
            if (songTitle && artist) {
                console.log('✅ Music metadata extracted successfully');
                return {
                    songTitle: songTitle,
                    artist: artist,
                    album: album,
                    albumCover: albumCover,
                    source: 'description',
                    isComplete: true
                };
            } else {
                console.log('⚠️ Music section found but incomplete - missing songTitle or artist');
                return null;
            }
        }
        
        const lines = descriptionText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        const musicaIndex = lines.findIndex(line => line.match(/^Música$/i) || line.match(/^Music$/i));
        if (musicaIndex !== -1) {
            const afterMusica = lines.slice(musicaIndex + 1);
            
            const validLines = afterMusica.filter(line => 
                !line.match(/^\d+\s+(cancion|song|track)/i) &&
                !line.match(/^Shorts/i) &&
                !line.match(/^[\d,\.]+\s*K?\s*Shorts$/i) &&
                line.length > 0
            );
            
            console.log('🔍 Debug: Lines after "Música":', validLines.slice(0, 5));
            
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
                    
                    console.log('✅ Music metadata extracted from description lines:', {
                        songTitle: potentialSong,
                        artist: potentialArtist,
                        album,
                        albumCover: albumCover?.substring(0, 50)
                    });
                    
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
            console.log('✅ Music metadata extracted via regex:', metadata);
            return { ...metadata, source: 'description-regex', isComplete: true };
        }
        
    } catch (error) {
        console.log('❌ Error extracting music metadata:', error);
    }
    
    console.log('📝 No music metadata found in description, will use title parsing');
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
    
    const descriptionMetadata = extractMusicMetadataFromDescription();
    if (descriptionMetadata && descriptionMetadata.isComplete) {
        songTitle = descriptionMetadata.songTitle;
        artist = descriptionMetadata.artist;
        album = descriptionMetadata.album || null;
        albumCover = descriptionMetadata.albumCover || null;
        metadataSource = descriptionMetadata.source;
        console.log(`✅ Using ${metadataSource} metadata`);
    } else {
        console.log('📝 Using title parsing fallback');
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
