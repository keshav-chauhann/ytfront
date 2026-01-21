import React, { useState } from 'react';
import { API_BASE_URL } from './config';
import { Helmet } from 'react-helmet-async';
import { Download, Video, Music, Settings, List, Clock, Folder, Play, Pause, Trash2, Edit3, Scissors, Globe, Moon, Sun, Plus, CheckCircle, AlertCircle, RefreshCw, Info } from 'lucide-react';

const YouTubeMediaSuite = () => {
  const [activeTab, setActiveTab] = useState('download');
  const [darkMode, setDarkMode] = useState(true);
  const [url, setUrl] = useState('');
  const [downloadType, setDownloadType] = useState('video');
  const [quality, setQuality] = useState('best');
  const [downloads, setDownloads] = useState([]);
  const [history, setHistory] = useState([]);
  const [notification, setNotification] = useState(null);
  
  // Video info state
  const [videoInfo, setVideoInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [availableVideoQualities, setAvailableVideoQualities] = useState(['best', '1080p', '720p', '480p', '360p']);
  const [availableAudioQualities, setAvailableAudioQualities] = useState(['best', '192k', '128k', '96k']);
  const [showFormatsDetails, setShowFormatsDetails] = useState(false);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const parseYouTubeUrl = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/playlist\?list=([^&\s]+)/,
      /youtube\.com\/@([^/\s]+)/,
      /youtube\.com\/channel\/([^/\s]+)/
    ];
    
    for (let pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleGetInfo = async () => {
    if (!url.trim()) {
      showNotification('Please enter a valid URL', 'error');
      return;
    }

    const videoId = parseYouTubeUrl(url);
    if (!videoId) {
      showNotification('Invalid YouTube URL', 'error');
      return;
    }

    setLoadingInfo(true);
    setVideoInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/video-info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        showNotification(data.error || 'Failed to fetch video info', 'error');
        setLoadingInfo(false);
        return;
      }

      setVideoInfo(data);
      setAvailableVideoQualities(data.available_video_qualities || ['best']);
      setAvailableAudioQualities(data.available_audio_qualities || ['best']);
      setQuality(data.available_video_qualities?.[0] || 'best');
      showNotification('Video information loaded successfully!', 'success');
    } catch (error) {
      showNotification('Failed to fetch video info. Make sure the server is running.', 'error');
      console.error('Info fetch error:', error);
    } finally {
      setLoadingInfo(false);
    }
  };

  const updateYtdlp = async () => {
    try {
      showNotification('Updating yt-dlp...', 'info');
      const response = await fetch(`${API_BASE_URL}/api/update-ytdlp`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        showNotification(data.message, 'success');
      } else {
        showNotification(data.error || 'Update failed', 'error');
      }
    } catch (error) {
      showNotification('Failed to update yt-dlp', 'error');
      console.error('Update error:', error);
    }
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      showNotification('Please enter a valid URL', 'error');
      return;
    }

    if (!videoInfo) {
      showNotification('Please scan the video first by clicking "Get Info"', 'error');
      return;
    }

    const newDownload = {
      id: Date.now(),
      url,
      videoId: parseYouTubeUrl(url),
      title: videoInfo.title || 'Unknown',
      type: downloadType,
      quality,
      status: 'downloading',
      progress: 0,
      speed: '0 MB/s',
      eta: 'Starting...',
      size: 'Unknown'
    };

    setDownloads([newDownload, ...downloads]);
    showNotification('Download started!', 'success');
    
    // Start actual download
    startActualDownload(newDownload);
  };

  const startActualDownload = async (download) => {
    try {
      const downloadUrl = `${API_BASE_URL}/api/download?url=${encodeURIComponent(download.url)}&type=${download.type}&quality=${download.quality}`;

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Download request failed');
      }

      // Read response as Blob
      const blob = await response.blob();

      // Try to infer filename from Content-Disposition
      const disposition = response.headers.get('Content-Disposition') || '';
      let filename = `download.${download.type === 'audio' ? 'mp3' : 'mp4'}`;
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      if (match) {
        filename = decodeURIComponent(match[1] || match[2] || filename);
      }

      // Trigger client-side save
      const urlObj = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlObj;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(urlObj);

      // Update UI
      setDownloads(prev => prev.map(d => (
        d.id === download.id
          ? { ...d, status: 'completed', progress: 100, speed: '0 MB/s', eta: 'Complete' }
          : d
      )));
      setHistory(prev => [{
        ...download,
        completedAt: new Date(),
        status: 'completed',
        progress: 100,
        format: (download.format || (download.type === 'audio' ? 'mp3' : 'mp4'))
      }, ...prev]);
      showNotification('Download saved to your local system.', 'success');
    } catch (error) {
      setDownloads(prev => prev.map(d => (
        d.id === download.id
          ? { ...d, status: 'failed', eta: 'Failed' }
          : d
      )));
      const errorMsg = error.message || 'Download failed';
      showNotification(errorMsg, 'error');
      console.error('Download error:', error);
    }
  };

  const pauseDownload = (id) => {
    setDownloads(prev => prev.map(d => 
      d.id === id ? { ...d, status: d.status === 'paused' ? 'downloading' : 'paused' } : d
    ));
    showNotification(downloads.find(d => d.id === id)?.status === 'paused' ? 'Download resumed' : 'Download paused', 'info');
  };

  const cancelDownload = (id) => {
    setDownloads(prev => prev.filter(d => d.id !== id));
    showNotification('Download cancelled', 'info');
  };

  const clearHistory = () => {
    setHistory([]);
    showNotification('History cleared', 'info');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Helmet>
        <title>YouTube Media Suite Pro</title>
        <meta name="description" content="Download YouTube videos and audio with quality controls, format conversion, and a modern UI powered by yt-dlp." />
        <meta name="keywords" content="YouTube downloader, video download, audio download, mp4, mp3, yt-dlp, React, Tailwind" />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : 'https://example.com/'} />
        <meta property="og:title" content="YouTube Media Suite Pro" />
        <meta property="og:description" content="All-in-one media solution for downloading and converting YouTube content." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={typeof window !== 'undefined' ? window.location.href : 'https://example.com/'} />
        <meta property="og:image" content="/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="YouTube Media Suite Pro" />
        <meta name="twitter:description" content="All-in-one media solution for downloading and converting YouTube content." />
        <meta name="twitter:image" content="/logo.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "YouTube Media Suite Pro",
            "description": "Download and convert YouTube videos and audio in multiple formats with quality controls.",
            "applicationCategory": "Multimedia",
            "operatingSystem": "Windows, macOS",
            "url": typeof window !== 'undefined' ? window.location.href : 'https://example.com/',
            "image": "/logo.png"
          })}
        </script>
      </Helmet>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-500' :
          notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        } text-white`}>
          {notification.type === 'success' && <CheckCircle size={20} />}
          {notification.type === 'error' && <AlertCircle size={20} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-red-500 to-pink-500 p-2 rounded-xl shadow-sm">
                <img src="/logo.png" alt="YouTube Media Suite" className="w-8 h-8 rounded-full object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">YouTube Media Suite Pro</h1>
                <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>All-in-one media solution</p>
              </div>
            </div>
            
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {[
              { id: 'download', icon: Download, label: 'Download' },
              { id: 'queue', icon: List, label: 'Queue', badge: downloads.length },
              { id: 'history', icon: Clock, label: 'History', badge: history.length },
              { id: 'convert', icon: Edit3, label: 'Convert' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-sm'
                    : darkMode ? 'bg-gray-700/80 hover:bg-gray-600/90' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="bg-white/90 text-red-500 text-xs px-2 py-0.5 rounded-full font-semibold shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Download Tab */}
        {activeTab === 'download' && (
          <div className="space-y-6">
            {/* URL Input */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Download size={20} />
                Enter YouTube URL
              </h2>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube video, playlist, or channel URL..."
                  className={`flex-1 px-4 py-3 rounded-lg ${
                    darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                  } border focus:outline-none focus:ring-2 focus:ring-red-500`}
                  onKeyPress={(e) => e.key === 'Enter' && handleGetInfo()}
                />
                <button
                  onClick={handleGetInfo}
                  disabled={loadingInfo}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loadingInfo ? <RefreshCw className="animate-spin" size={20} /> : <Info size={20} />}
                  Get Info
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!videoInfo}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-pink-600 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Download size={20} />
                  Download
                </button>
              </div>

              {/* Video Info Display */}
              {videoInfo && (
                <div className={`mb-4 p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <div className="flex gap-4">
                    {videoInfo.thumbnail && (
                      <img 
                        src={videoInfo.thumbnail} 
                        alt="Video thumbnail" 
                        className="w-40 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{videoInfo.title}</h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                        {videoInfo.uploader} • {videoInfo.duration_string} • {videoInfo.view_count?.toLocaleString()} views
                      </p>
                      {videoInfo.description && (
                        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {videoInfo.description}
                        </p>
                      )}
                      <button
                        onClick={() => setShowFormatsDetails(!showFormatsDetails)}
                        className={`mt-2 text-sm text-blue-500 hover:text-blue-400 flex items-center gap-1`}
                      >
                        {showFormatsDetails ? '▼' : '▶'} Show available formats
                      </button>
                      {showFormatsDetails && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium">Video Qualities: {videoInfo.available_video_qualities?.join(', ')}</p>
                          <p className="font-medium">Audio Qualities: {videoInfo.available_audio_qualities?.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Download Type */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={() => setDownloadType('video')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    downloadType === 'video'
                      ? 'border-red-500 bg-red-500/10'
                      : darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Video className="mx-auto mb-2" size={24} />
                  <div className="font-semibold">Video</div>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Download with audio
                  </div>
                </button>
                
                <button
                  onClick={() => setDownloadType('audio')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    downloadType === 'audio'
                      ? 'border-red-500 bg-red-500/10'
                      : darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Music className="mx-auto mb-2" size={24} />
                  <div className="font-semibold">Audio Only</div>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Extract audio track
                  </div>
                </button>
              </div>

              {/* Quality & Format Selection */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {downloadType === 'video' ? 'Video Quality' : 'Audio Quality'}
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className={`w-full px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                    } border focus:outline-none focus:ring-2 focus:ring-red-500`}
                  >
                    {downloadType === 'video' ? (
                      availableVideoQualities.map(q => <option key={q} value={q}>{q}</option>)
                    ) : (
                      availableAudioQualities.map(q => <option key={q} value={q}>{q}</option>)
                    )}
                  </select>
                  {videoInfo && (
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {downloadType === 'video' 
                        ? `${availableVideoQualities.length - 1} qualities available`
                        : `${availableAudioQualities.length - 1} qualities available`
                      }
                    </p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Actions
                  </label>
                  <button
                    onClick={updateYtdlp}
                    className={`w-full px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                    } transition-colors flex items-center justify-center gap-2`}
                  >
                    <RefreshCw size={16} />
                    Update yt-dlp
                  </button>
                </div>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: Scissors, title: 'Smart Trimming', desc: 'Cut videos before download' },
                { icon: Globe, title: 'Auto Subtitles', desc: 'AI-generated & translated' },
                { icon: Folder, title: 'Batch Downloads', desc: 'Playlists & channels' },
                { icon: CheckCircle, title: 'Quality Control', desc: 'Best available quality' },
                { icon: Music, title: 'Format Conversion', desc: 'Multiple audio/video formats' },
                { icon: Settings, title: 'Advanced Tools', desc: 'Merge, enhance, & more' }
              ].map((feature, i) => (
                <div key={i} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 shadow-lg`}>
                  <feature.icon className="text-red-500 mb-2" size={24} />
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}  

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <List size={24} />
              Download Queue
            </h2>

            {downloads.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-12 text-center shadow-lg`}>
                <Download size={48} className="mx-auto mb-4 text-gray-500" />
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                  No active downloads. Start downloading from the Download tab.
                </p>
              </div>
            ) : (
              downloads.map(download => (
                <div key={download.id} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{download.title}</h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {download.type === 'audio' ? 'Audio' : 'Video'} • {(download.format || (download.type === 'audio' ? 'mp3' : 'mp4')).toUpperCase()} • {download.quality}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => pauseDownload(download.id)}
                        className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                        disabled={download.status === 'completed'}
                      >
                        {download.status === 'paused' ? <Play size={18} /> : <Pause size={18} />}
                      </button>
                      <button
                        onClick={() => cancelDownload(download.id)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{Math.round(download.progress)}%</span>
                      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                        {download.speed} • {download.eta}
                      </span>
                    </div>
                    <div className={`w-full h-2 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-300'} overflow-hidden`}>
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${download.progress}%` }}
                      />
                    </div>
                  </div>

                  {download.status === 'completed' && (
                    <button className="w-full mt-2 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600">
                      Open File
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Clock size={24} />
                Download History
              </h2>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg font-medium"
                >
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-12 text-center shadow-lg`}>
                <Clock size={48} className="mx-auto mb-4 text-gray-500" />
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                  No download history yet.
                </p>
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{item.title}</h3>
                      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {item.type === 'audio' ? 'Audio' : 'Video'} • {(item.format || (item.type === 'audio' ? 'mp3' : 'mp4')).toUpperCase()} • {item.quality}
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-medium hover:from-red-600 hover:to-pink-600">
                      Download Again
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Convert Tab */}
        {activeTab === 'convert' && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
              <Edit3 size={24} />
              Media Converter
            </h2>
            
            <div className="text-center py-12">
              <Plus size={48} className="mx-auto mb-4 text-gray-500" />
              <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Drag and drop files here or click to browse
              </p>
              <button className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-pink-600">
                Select Files
              </button>
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <h3 className="font-semibold mb-2">Video Conversion</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Convert between MP4, MKV, WEBM, AVI
                </p>
              </div>
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <h3 className="font-semibold mb-2">Audio Extraction</h3>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Extract audio as MP3, AAC, WAV, FLAC
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Settings size={24} />
              Settings
            </h2>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg space-y-6`}>
              <div>
                <h3 className="font-semibold mb-3">Download Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Default Save Location</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value="/Downloads/YouTube"
                        readOnly
                        className={`flex-1 px-4 py-2 rounded-lg ${
                          darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                        } border`}
                      />
                      <button className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}>
                        Browse
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-organize by channel</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Verify file integrity</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Enable parallel downloads</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Performance</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Concurrent Downloads</label>
                    <select
                      defaultValue="3"
                      className={`w-full px-4 py-2 rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                      } border`}
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="5">5</option>
                      <option value="10">10</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Download Speed Limit</label>
                    <select className={`w-full px-4 py-2 rounded-lg ${
                      darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                    } border`}>
                      <option>Unlimited</option>
                      <option>10 MB/s</option>
                      <option>5 MB/s</option>
                      <option>1 MB/s</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Privacy & Security</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Use proxy/VPN</span>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Clear download history on exit</span>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Enable rate limiting</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Naming & Organization</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Filename Pattern</label>
                    <input
                      type="text"
                      defaultValue="{title} - {channel} [{quality}]"
                      className={`w-full px-4 py-2 rounded-lg ${
                        darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'
                      } border`}
                    />
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Available tags: {'{title}'}, {'{channel}'}, {'{quality}'}, {'{date}'}, {'{id}'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-tag metadata</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detect duplicates</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Advanced Features</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Enable chapter detection</span>
                    <input type="checkbox" className="w-5 h-5" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Audio enhancement/noise reduction</span>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Generate video previews</span>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monitor RSS feeds for new videos</span>
                    <input type="checkbox" className="w-5 h-5" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Cloud Integration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className={`p-3 rounded-lg border-2 ${
                    darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'
                  } text-left`}>
                    <div className="font-medium">Google Drive</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Not connected</div>
                  </button>
                  
                  <button className={`p-3 rounded-lg border-2 ${
                    darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-300 hover:border-gray-400'
                  } text-left`}>
                    <div className="font-medium">Dropbox</div>
                    <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Not connected</div>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <button className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-pink-600">
                  Save Settings
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <div className={`${darkMode ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-100 border-yellow-300'} border rounded-xl p-4`}>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle size={20} className="text-yellow-500" />
                Legal Disclaimer
              </h3>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                This tool is for downloading content you own or have permission to use. Downloading copyrighted content without authorization may violate copyright laws. Users are responsible for ensuring their use complies with applicable laws and YouTube's Terms of Service.
              </p>
            </div>

            {/* About */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-lg`}>
              <h3 className="font-semibold mb-3">About YouTube Media Suite Pro</h3>
              <div className={`text-sm space-y-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <p><strong>Version:</strong> 1.0.0</p>
                <p><strong>Features:</strong> Video/Audio Downloads, Format Conversion, Subtitle Generation, Batch Processing, Smart Trimming, and more</p>
                <p><strong>Supported Formats:</strong></p>
                <ul className="list-disc list-inside ml-4">
                  <li>Video: MP4, WEBM, MKV, AVI</li>
                  <li>Audio: MP3, AAC, WAV, FLAC, OPUS</li>
                  <li>Subtitles: SRT, VTT</li>
                </ul>
                <p className="pt-2"><strong>Keyboard Shortcuts:</strong></p>
                <ul className="list-disc list-inside ml-4">
                  <li>Ctrl/Cmd + V: Paste URL</li>
                  <li>Ctrl/Cmd + D: Start Download</li>
                  <li>Ctrl/Cmd + P: Pause/Resume</li>
                  <li>Ctrl/Cmd + L: Toggle Dark/Light Mode</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t mt-12`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              © 2026 YouTube Media Suite Pro. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <button className="hover:text-red-500 transition-colors">Documentation</button>
              <button className="hover:text-red-500 transition-colors">API Access</button>
              <button className="hover:text-red-500 transition-colors">Support</button>
              <button className="hover:text-red-500 transition-colors">Privacy Policy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YouTubeMediaSuite;