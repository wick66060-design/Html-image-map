/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Map as MapIcon, Copy, Loader2, Sparkles, AlertCircle, Check, Code, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractRegionCoordinates } from './services/gemini';
import { ImageMetadata, RegionData } from './types';

export default function App() {
  const [image, setImage] = useState<ImageMetadata | null>(null);
  const [regionsInput, setRegionsInput] = useState('Tigray, Somali, Oromia, Addis Ababa, Gambela');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetWidth, setTargetWidth] = useState<string>('');
  const [targetHeight, setTargetHeight] = useState<string>('');
  const [linkTarget, setLinkTarget] = useState<string>('_blank');
  const [result, setResult] = useState<{ html: string; regions: RegionData[] } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [includeResponsiveScript, setIncludeResponsiveScript] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage({
            width: img.width,
            height: img.height,
            name: file.name,
            type: file.type,
            dataUrl: event.target?.result as string,
          });
          setResult(null);
          setError(null);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const generateMap = async () => {
    if (!image) return;
    
    setError(null);
    setIsGenerating(true);
    
    const names = regionsInput.split(',').map(s => s.trim()).filter(Boolean);
    
    if (names.length === 0) {
      setError("Please specify at least one region name.");
      setIsGenerating(false);
      return;
    }

    try {
      const regions = await extractRegionCoordinates(image.dataUrl, names);
      
      const mapName = `map_${Math.random().toString(36).substring(2, 9)}`;
      
      const finalWidth = targetWidth ? parseInt(targetWidth) : image.width;
      const finalHeight = targetHeight ? parseInt(targetHeight) : image.height;

      const areaTags = regions.map(region => {
        // Scale points from 0-1000 to actual pixels
        const scaledPoints = region.points.map(([px, py]) => {
          const x = Math.round((px / 1000) * finalWidth);
          const y = Math.round((py / 1000) * finalHeight);
          return `${x},${y}`;
        }).join(',');

        const targetAttr = linkTarget ? ` target="${linkTarget}"` : '';

        return `  <area shape="poly" coords="${scaledPoints}" alt="${region.name}" title="${region.name}" href="#"${targetAttr} onclick="alert('${region.name} clicked'); return false;">`;
      }).join('\n');

      let html = `<img src="${image.name}" usemap="#${mapName}" width="${finalWidth}" height="${finalHeight}" alt="${image.name.split('.')[0]}" />\n\n<map name="${mapName}">\n${areaTags}\n</map>`;

      if (includeResponsiveScript) {
        html += `\n\n<!-- Responsive Image Map Script -->
<script>
(function() {
  function resizeMap() {
    const maps = document.getElementsByTagName('map');
    for (let i = 0; i < maps.length; i++) {
      const map = maps[i];
      const img = document.querySelector('img[usemap="#' + map.name + '"]');
      if (!img) continue;
      
      const areas = map.getElementsByTagName('area');
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const currentW = img.clientWidth;
      const currentH = img.clientHeight;
      
      if (!img._origCoords) {
        img._origCoords = [];
        for (let j = 0; j < areas.length; j++) {
          img._origCoords[j] = areas[j].coords.split(',');
        }
      }
      
      for (let j = 0; j < areas.length; j++) {
        const coords = img._origCoords[j];
        const newCoords = [];
        for (let k = 0; k < coords.length; k++) {
          if (k % 2 === 0) {
            newCoords.push(Math.round(coords[k] * (currentW / w)));
          } else {
            newCoords.push(Math.round(coords[k] * (currentH / h)));
          }
        }
        areas[j].coords = newCoords.join(',');
      }
    }
  }
  window.addEventListener('resize', resizeMap);
  window.addEventListener('load', resizeMap);
  setTimeout(resizeMap, 100);
})();
</script>`;
      }

      setResult({ html, regions });
    } catch (err: any) {
      setError(err.message || "An error occurred during mapping.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.html);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <MapIcon className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Polygon Map Generator</h1>
          <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">v1.2.4</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            disabled={isGenerating}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {image ? 'Change Image' : 'Upload Image'}
          </button>
          <button 
            disabled={!result || isGenerating}
            onClick={copyToClipboard}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copySuccess ? 'Copied' : 'Export Map HTML'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Controls */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Configuration</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Region Input */}
            <section className="space-y-3">
              <label className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">01. Target Regions</label>
              <textarea
                value={regionsInput}
                onChange={(e) => setRegionsInput(e.target.value)}
                placeholder="Enter region names..."
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none leading-relaxed"
              />
              <p className="text-[10px] text-slate-400 italic">Separate with commas (e.g., Tigray, Somali).</p>
            </section>

            {/* Options */}
            <section className="space-y-3">
              <label className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">02. Generator Settings</label>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Width</label>
                    <input 
                      type="number" 
                      value={targetWidth}
                      onChange={(e) => setTargetWidth(e.target.value)}
                      placeholder={image ? String(image.width) : "Auto"}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Height</label>
                    <input 
                      type="number" 
                      value={targetHeight}
                      onChange={(e) => setTargetHeight(e.target.value)}
                      placeholder={image ? String(image.height) : "Auto"}
                      className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Link Target</label>
                  <select
                    value={linkTarget}
                    onChange={(e) => setLinkTarget(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">None (Default)</option>
                    <option value="_blank">_blank (New Tab)</option>
                    <option value="_self">_self (Same Frame)</option>
                    <option value="_parent">_parent (Parent Frame)</option>
                    <option value="_top">_top (Full Body)</option>
                  </select>
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <input 
                    type="checkbox" 
                    id="responsive"
                    checked={includeResponsiveScript}
                    onChange={(e) => setIncludeResponsiveScript(e.target.checked)}
                    className="accent-blue-600 w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <label htmlFor="responsive" className="text-xs font-medium text-slate-700 cursor-pointer select-none leading-tight">
                    Inject responsive scaling script <br/>
                    <span className="text-[10px] font-normal opacity-60">Ensures coords match image size on resize.</span>
                  </label>
                </div>
              </div>
            </section>

            {/* Execute */}
            <button
              disabled={!image || isGenerating}
              onClick={generateMap}
              className="w-full bg-slate-900 text-white py-3.5 rounded-lg font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-slate-200"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <span>Execute Analysis</span>
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-50 border border-red-100 rounded-lg flex gap-2 text-red-600 text-[11px] font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />

          <div className="p-4 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Engine: Gemini-3-V</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Topological border extraction active.</p>
          </div>
        </aside>

        {/* Center: Image Area */}
        <section className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded border border-slate-200 shadow-sm shrink-0">
            <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
              {image ? `Image Preview: ${image.name}` : 'Waiting for Source Image...'}
            </span>
            {image && (
              <div className="flex gap-4 text-xs font-mono text-slate-400">
                <span>{image.width} × {image.height}px</span>
                <span className="text-blue-500 font-bold uppercase text-[10px]">Source Active</span>
              </div>
            )}
          </div>

          <div className="flex-1 bg-slate-200 rounded-xl relative overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-300 shadow-inner group">
            <AnimatePresence mode="wait">
              {!image ? (
                <motion.div 
                  key="upload-prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-200 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-600 font-bold text-sm">Drop your image here</p>
                    <p className="text-slate-400 text-[11px] uppercase tracking-widest font-semibold mt-1">or click to browse local files</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative w-full h-full flex items-center justify-center p-8"
                >
                  <div className="relative shadow-2xl rounded overflow-hidden bg-white drop-shadow-2xl">
                    <img 
                      src={image.dataUrl} 
                      alt="Source" 
                      className="max-w-full max-h-full block object-contain"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Overlay Regions */}
                    {result && result.regions.map((region, idx) => (
                      <svg 
                        key={idx} 
                        className="absolute inset-0 w-full h-full pointer-events-none" 
                        viewBox={`0 0 ${image.width} ${image.height}`}
                      >
                        <polygon
                          points={region.points.map(([px, py]) => `${(px/1000)*image.width},${(py/1000)*image.height}`).join(' ')}
                          className="fill-blue-500/30 stroke-blue-600 stroke-[3px]"
                        />
                        <text
                          x={(region.points[0][0]/1000)*image.width}
                          y={(region.points[0][1]/1000)*image.height}
                          className="fill-white text-[14px] font-bold"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                        >
                          {region.name}
                        </text>
                        {/* Start point marker */}
                        <circle 
                          cx={(region.points[0][0]/1000)*image.width} 
                          cy={(region.points[0][1]/1000)*image.height} 
                          r="6" 
                          fill="#ef4444" 
                          stroke="white" 
                          strokeWidth="2" 
                        />
                      </svg>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Right Sidebar: Output */}
        <aside className="w-[450px] bg-white border-l border-slate-200 flex flex-col shadow-xl z-10">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Generated Output</h2>
            {result && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Synthesis Complete
              </span>
            )}
          </div>

          <div className="flex-1 bg-slate-900 p-6 font-mono text-[11px] leading-relaxed text-slate-300 overflow-y-auto">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 opacity-30 italic">
                <Code className="w-8 h-8" />
                <span>Payload ready for generation...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] border-b border-slate-800 pb-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>IMAGE MAP DATA STREAM</span>
                </div>
                <pre className="whitespace-pre-wrap break-all text-blue-300/90 selection:bg-blue-500 selection:text-white">
                  {result.html}
                </pre>
              </div>
            )}
          </div>

          {result && (
            <div className="p-5 bg-slate-50 border-t border-slate-200">
              <div className="flex justify-between items-center mb-5">
                <span className="text-xs font-bold text-slate-500 tracking-wide uppercase">Coverage Data</span>
                <span className="text-xs font-bold text-blue-600">Calculated Pixel Precision</span>
              </div>
              <div className="space-y-3">
                {result.regions.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 group">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm group-hover:scale-125 transition-transform"></div>
                    <span className="text-xs font-semibold text-slate-700 flex-1">{r.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">{r.points.length} nodes</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={copyToClipboard}
                className="w-full mt-6 py-2.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 transition-all shadow-sm active:scale-[0.98]"
              >
                Copy HTML to Clipboard
              </button>
            </div>
          )}
        </aside>
      </main>

      {/* Footer */}
      <footer className="h-10 bg-slate-100 border-t border-slate-200 px-6 flex items-center justify-between shrink-0 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
          <span>Precision Mapping Engine Active</span>
        </div>
        <div>Coord Space: Absolute Pixel // ROI Selection: {regionsInput.split(',').length} Identified</div>
        <div className="flex items-center gap-4">
          <span>Lat: 2026.04.20</span>
          <span className="text-slate-300">|</span>
          <span>Status: Ready</span>
        </div>
      </footer>
    </div>
  );
}
