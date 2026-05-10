import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Upload, Download, Watch, Image as ImageIcon, FileText, CheckCircle2, Circle, Square, Zap, ChevronDown, Moon, Sun, Monitor, Github, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const KofiIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.724c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267.023 11.966-.049c2.438-.042 2.678-2.593 2.678-2.593l.01-2.128s4.625.201 6.118-4.949c.594-2.316-.25-4.226-.5-5.048zm-4.351 5.928c-.802.005-1.502-.006-1.502-.006l-.01 2.441s-.11 1.258-1.42 1.258C13.43 18.57 6.442 18.583 6.442 18.583c-1.31 0-1.42-1.258-1.42-1.258V6.012c0-1.31 1.05-1.419 1.05-1.419h7.491s1.05.109 1.05 1.419c0 1.309 0 5.485 0 5.485s.104 1.378 1.421 1.378h.744c.48 0 1.139-.026 1.139-.026v1.944s-.104 2.128-2.128 2.128zm3.08-1.402c-.36 1.136-1.042 1.583-1.042 1.583l.006-3.825s.682-.447 1.042 1.583c.36 2.03.36 2.03.36 2.03z"/>
  </svg>
);

export default function App() {
  const [watchType, setWatchType] = useState<'circle' | 'square'>('circle');
  const [targetSize, setTargetSize] = useState<number>(720);
  const [isTurboMode, setIsTurboMode] = useState<boolean>(true);
  const [bezelFile, setBezelFile] = useState<File | null>(null);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [layoutPreview, setLayoutPreview] = useState('');
  const [isLayoutVisible, setIsLayoutVisible] = useState(false);
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();

    const handleChange = () => {
      if (theme === 'auto') applyTheme();
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Calculate layout dimensions based on target display size
  const calculateDimensions = (size: number, type: 'circle' | 'square') => {
    if (type === 'circle') {
      // Using the new reference: display is 480, layout is 530, offset is 25
      const origDisplay = 480;
      const origOffset = 25;

      const scale = size / origDisplay;
      
      // We scale the offset proportionally so the hole in the resized image matches the target size perfectly.
      const offset = Math.round(origOffset * scale);
      const layoutSize = size + offset * 2;
      
      // Scale the corner radius proportionally (original was 210 for 480 display)
      const cornerRadius = Math.round(size * (210 / 480));

      return { 
        layoutWidth: layoutSize, 
        layoutHeight: layoutSize, 
        displayWidth: size,
        displayHeight: size,
        bezelWidth: layoutSize,
        bezelHeight: layoutSize,
        bezelX: 0,
        bezelY: 0,
        displayX: offset,
        displayY: offset,
        cornerRadius 
      };
    } else {
      // Square / Rectangular
      const origDisplayW = 402;
      const origDisplayH = 476;
      const origBezelW = 434;
      const origBezelH = 508;
      const origLayoutW = 466;
      const origLayoutH = 540;
      const origBezelX = 16;
      const origBezelY = 16;
      const origDisplayX = 32;
      const origDisplayY = 32;

      // The input size is treated as the target width
      const scale = size / origDisplayW;

      const displayWidth = size;
      const displayHeight = Math.round(origDisplayH * scale);
      
      const bezelWidth = Math.round(origBezelW * scale);
      const bezelHeight = Math.round(origBezelH * scale);

      const bezelX = Math.round(origBezelX * scale);
      const bezelY = Math.round(origBezelY * scale);

      const displayX = Math.round(origDisplayX * scale);
      const displayY = Math.round(origDisplayY * scale);

      const layoutWidth = Math.round(origLayoutW * scale);
      const layoutHeight = Math.round(origLayoutH * scale);

      return {
        layoutWidth,
        layoutHeight,
        displayWidth,
        displayHeight,
        bezelWidth,
        bezelHeight,
        bezelX,
        bezelY,
        displayX,
        displayY,
        cornerRadius: 0
      };
    }
  };

  useEffect(() => {
    const dims = calculateDimensions(targetSize || 720, watchType);
    
    // In turbo mode, square doesn't use a mask. In custom mode, it depends on maskFile.
    const hasMask = isTurboMode ? watchType === 'circle' : !!maskFile;
    
    const maskSection = hasMask ? `
        foreground {
            mask    device_mask.png
        }` : '';

    const cornerRadiusSection = watchType === 'circle' ? `\n            corner_radius ${dims.cornerRadius}` : '';

    const preview = `parts {
    portrait {
        background {
            image   device_bezel.png
        }${maskSection}
    }

    device {
        display {
            width   ${dims.displayWidth}
            height  ${dims.displayHeight}
            x       0
            y       0${cornerRadiusSection}
        }
    }
}

layouts {
    portrait {
        width     ${dims.layoutWidth}
        height    ${dims.layoutHeight}

        part1 {
            name    portrait
            x       ${dims.bezelX}
            y       ${dims.bezelY}
        }

        part2 {
            name    device
            x       ${dims.displayX}
            y       ${dims.displayY}
        }
    }
}`;
    setLayoutPreview(preview);
  }, [targetSize, watchType, isTurboMode, maskFile]);

  const fetchLocalImage = async (filename: string): Promise<File> => {
    const response = await fetch(`/${filename}`);
    const blob = await response.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const resizeImage = (file: File, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleGenerate = async () => {
    if (!targetSize) return;
    if (!isTurboMode && !bezelFile) return;
    
    setIsGenerating(true);
    try {
      const dims = calculateDimensions(targetSize, watchType);
      const zip = new JSZip();
      zip.file('layout', layoutPreview);

      if (isTurboMode) {
        const bezelName = watchType === 'circle' ? 'device_bezel.png' : 'device_bezel-1.png';
        const bezelBlob = await fetchLocalImage(bezelName);
        const resizedBezel = await resizeImage(bezelBlob, dims.bezelWidth, dims.bezelHeight);
        zip.file('device_bezel.png', resizedBezel);

        if (watchType === 'circle') {
          const maskBlob = await fetchLocalImage('device_mask.png');
          const resizedMask = await resizeImage(maskBlob, dims.bezelWidth, dims.bezelHeight);
          zip.file('device_mask.png', resizedMask);
        }
      } else {
        const resizedBezel = await resizeImage(bezelFile!, dims.bezelWidth, dims.bezelHeight);
        zip.file('device_bezel.png', resizedBezel);
        
        if (maskFile) {
          const resizedMask = await resizeImage(maskFile, dims.bezelWidth, dims.bezelHeight);
          zip.file('device_mask.png', resizedMask);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `wearos_skin_${dims.displayWidth}x${dims.displayHeight}.zip`);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error generating skin:', error);
      alert('An error occurred while generating the skin.');
    } finally {
      setIsGenerating(false);
    }
  };

  const dims = calculateDimensions(targetSize || 720, watchType);
  const hasMask = isTurboMode ? watchType === 'circle' : !!maskFile;

  const Highlight = ({ children }: { children: React.ReactNode }) => (
    <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1 py-0.5 rounded font-bold">{children}</span>
  );

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans p-6 md:p-12 transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-8">
        
        <header className="flex items-center justify-between pb-6 border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Watch className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Android Emulator Skins Resizer</h1>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">Scale Wear OS and Android emulator skins automatically</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (theme === 'auto') setTheme('light');
              else if (theme === 'light') setTheme('dark');
              else setTheme('auto');
            }} 
            className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm flex items-center justify-center w-10 h-10"
            title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
          >
            {theme === 'auto' && <span className="material-icons text-[20px] leading-none">&#xe1ab;</span>}
            {theme === 'light' && <Sun className="w-5 h-5" />}
            {theme === 'dark' && <Moon className="w-5 h-5" />}
          </button>
        </header>

        <div className="space-y-8">
          
          {/* Main App Body: Controls */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 space-y-6 transition-colors duration-300">
              
              {/* Watch Type Picker */}
              <div className="flex justify-center">
                <div className="flex items-center space-x-2 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl w-fit transition-colors duration-300">
                  <button
                    onClick={() => setWatchType('circle')}
                    title="Round"
                    className={`p-3 rounded-lg transition-all ${
                      watchType === 'circle'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Circle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setWatchType('square')}
                    title="Square"
                    className={`p-3 rounded-lg transition-all ${
                      watchType === 'square'
                        ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Turbo Mode Toggle */}
              <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors duration-300 ${
                isTurboMode 
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50' 
                  : 'bg-neutral-50 dark:bg-neutral-800/30 border-neutral-200 dark:border-neutral-700'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg transition-colors duration-300 ${
                    isTurboMode ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-neutral-200 dark:bg-neutral-800'
                  }`}>
                    <Zap className={`w-5 h-5 transition-colors duration-300 ${
                      isTurboMode ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className={`text-sm font-medium transition-colors duration-300 ${
                      isTurboMode ? 'text-blue-900 dark:text-blue-100' : 'text-neutral-700 dark:text-neutral-300'
                    }`}>Turbo Mode</h3>
                    <p className={`text-xs transition-colors duration-300 ${
                      isTurboMode ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-500 dark:text-neutral-400'
                    }`}>Automatically use built-in high-quality skin files</p>
                  </div>
                </div>
                <div className="relative inline-flex items-center">
                  <input type="checkbox" className="sr-only peer" checked={isTurboMode} onChange={(e) => setIsTurboMode(e.target.checked)} />
                  <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-neutral-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                </div>
              </label>

              {/* Target Size Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Target Display Size (px)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetSize}
                    onChange={(e) => setTargetSize(Number(e.target.value))}
                    className="w-full pl-4 pr-12 py-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none text-neutral-900 dark:text-white"
                    placeholder="720"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-sm font-medium">
                    px
                  </span>
                </div>
              </div>

              {!isTurboMode && (
                <>
                  <hr className="border-neutral-100 dark:border-neutral-800 transition-colors duration-300" />

                  {/* File Uploads */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Original Images
                    </label>
                    
                    {/* Bezel Upload */}
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => setBezelFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-colors ${bezelFile ? 'border-green-500 dark:border-green-500/70 bg-green-50 dark:bg-green-900/20' : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 group-hover:border-blue-400 dark:group-hover:border-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'}`}>
                        <div className="flex items-center space-x-3">
                          <ImageIcon className={`w-5 h-5 ${bezelFile ? 'text-green-600 dark:text-green-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                          <span className={`text-sm font-medium ${bezelFile ? 'text-green-700 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                            {bezelFile ? bezelFile.name : 'Upload device_bezel.png'}
                          </span>
                        </div>
                        {bezelFile ? <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" /> : <Upload className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />}
                      </div>
                    </div>

                    {/* Mask Upload */}
                    <div className="relative group">
                      <input
                        type="file"
                        accept="image/png"
                        onChange={(e) => setMaskFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-colors ${maskFile ? 'border-green-500 dark:border-green-500/70 bg-green-50 dark:bg-green-900/20' : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 group-hover:border-blue-400 dark:group-hover:border-blue-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'}`}>
                        <div className="flex items-center space-x-3">
                          <ImageIcon className={`w-5 h-5 ${maskFile ? 'text-green-600 dark:text-green-400' : 'text-neutral-400 dark:text-neutral-500'}`} />
                          <span className={`text-sm font-medium ${maskFile ? 'text-green-700 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                            {maskFile ? maskFile.name : 'Upload device_mask.png (Optional, but recommended)'}
                          </span>
                        </div>
                        {maskFile ? <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" /> : <Upload className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Action Button */}
              <button
                onClick={handleGenerate}
                disabled={(!isTurboMode && !bezelFile) || !targetSize || isGenerating}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-600 text-white rounded-xl font-medium transition-all flex items-center justify-center space-x-2 shadow-sm disabled:shadow-none"
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>Generate & Download ZIP</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Section: Preview */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden h-fit transition-colors duration-300">
            <button 
              onClick={() => setIsLayoutVisible(!isLayoutVisible)}
              className="w-full p-6 flex items-center justify-between bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors duration-300">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">Generated Layout File</h2>
              </div>
              <ChevronDown className={`w-5 h-5 text-neutral-400 transition-transform duration-300 ${isLayoutVisible ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ease-in-out ${isLayoutVisible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <div className="p-6 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800 flex flex-col transition-colors duration-300">
                  <pre className="text-neutral-600 dark:text-neutral-400 font-mono text-xs leading-relaxed whitespace-pre-wrap">
{`parts {
    portrait {
        background {
            image   device_bezel.png
        }`}
{hasMask && `
        foreground {
            mask    device_mask.png
        }`}
{`
    }

    device {
        display {
            width   `}<Highlight>{dims.displayWidth}</Highlight>{`
            height  `}<Highlight>{dims.displayHeight}</Highlight>{`
            x       0
            y       0`}
{watchType === 'circle' && (
  <>
{`
            corner_radius `}<Highlight>{dims.cornerRadius}</Highlight>
  </>
)}
{`
        }
    }
}

layouts {
    portrait {
        width     `}<Highlight>{dims.layoutWidth}</Highlight>{`
        height    `}<Highlight>{dims.layoutHeight}</Highlight>{`

        part1 {
            name    portrait
            x       `}{dims.bezelX === 0 ? '0' : <Highlight>{dims.bezelX}</Highlight>}{`
            y       `}{dims.bezelY === 0 ? '0' : <Highlight>{dims.bezelY}</Highlight>}{`
        }

        part2 {
            name    device
            x       `}<Highlight>{dims.displayX}</Highlight>{`
            y       `}<Highlight>{dims.displayY}</Highlight>{`
        }
    }
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* SEO Content: How it Works & FAQ for AI Crawlers */}
          <section className="pt-8 pb-4 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">About Android Emulator Skins Resizer</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                When developing wear OS or testing normal apps, you often need the perfect Android emulator skin size for Android Studio. Instead of calculating layout offsets, layout coordinates, or resizing bezier image masks manually, this free tool handles everything.
              </p>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-2">How do I resize an emulator skin?</h3>
              <ol className="text-sm text-neutral-600 dark:text-neutral-400 space-y-3 list-decimal list-inside">
                <li><strong className="text-neutral-800 dark:text-neutral-300">Choose your watch type:</strong> Select either a circular Wear OS emulator skin or a square smartwatch skin layout.</li>
                <li><strong className="text-neutral-800 dark:text-neutral-300">Pick Target Size:</strong> Enter the target width in pixels (e.g., 720). The resizer will instantly calculate new image sizes and <code>layout</code> offset numbers.</li>
                <li><strong className="text-neutral-800 dark:text-neutral-300">Upload or Turbo Mode:</strong> You can upload your own <code>device_bezel.png</code> or use the built-in high definition defaults (Turbo Mode).</li>
                <li><strong className="text-neutral-800 dark:text-neutral-300">Export:</strong> Click Generate to instantly get a valid `.zip` package format ready to be placed in the Android Studio skins directory.</li>
              </ol>
            </div>
          </section>

        </div>
      </div>

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
            >
              <div className="p-1 bg-blue-600 h-1.5 full" />
              <div className="p-8 space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center ring-8 ring-green-50 dark:ring-green-900/10">
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Skin Generated!</h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Your custom emulator skin has been ready and downloaded. Enjoy your testing!
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  <a 
                    href="https://ko-fi.com/saderius" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-3 py-3 px-4 bg-[#29abe0] hover:bg-[#228db9] text-white rounded-xl font-semibold transition-colors shadow-sm"
                  >
                    <KofiIcon className="w-5 h-5 fill-white" />
                    <span>Support on Ko-fi</span>
                  </a>
                  
                  <a 
                    href="https://github.com/Saderius/WearOS-Skin-Scaler" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center space-x-3 py-3 px-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl font-semibold transition-colors border border-neutral-200 dark:border-neutral-700 shadow-sm"
                  >
                    <Github className="w-5 h-5" />
                    <span>View on GitHub</span>
                  </a>
                </div>

                <button 
                  onClick={() => setShowSuccessModal(false)}
                  className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
