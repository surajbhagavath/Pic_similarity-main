import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import { loadModel, detectObjects, calculateSimilarity } from './utils/similarityEngine';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, AlertCircle, CheckCircle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
          <div className="bg-red-900/50 p-6 rounded-2xl border border-red-500 max-w-lg">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="mb-4">The application encountered an expected error.</p>
            <code className="block bg-black/50 p-4 rounded text-sm overflow-auto max-h-40">
              {this.state.error && this.state.error.toString()}
            </code>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function InnerApp() {
  const [img1, setImg1] = useState(null);
  const [img2, setImg2] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading AI Model...");

  useEffect(() => {
    const init = async () => {
      try {
        console.log("App mounting, loading models...");
        await loadModel();
        setModelReady(true);
        setLoadingText("");
        console.log("Models loaded in App");
      } catch (e) {
        console.error("Model load error:", e);
        setLoadingText("Failed to load model. Check console.");
      }
    };
    init();
  }, []);

  const handleAnalyze = async () => {
    if (!img1 || !img2) return;
    setAnalyzing(true);
    setResult(null);
    setLoadingText("Detecting objects and colors...");
    console.log("Analyzing...");

    try {
      await new Promise(r => setTimeout(r, 100));

      const imageElement1 = document.getElementById('img-Image1');
      const imageElement2 = document.getElementById('img-Image2');

      console.log("Images:", imageElement1, imageElement2);

      if (!imageElement1 || !imageElement2) throw new Error("Images not found in DOM");
      if (imageElement1.naturalWidth === 0 || imageElement2.naturalWidth === 0) throw new Error("Images not fully loaded");

      const det1 = await detectObjects(imageElement1);
      const det2 = await detectObjects(imageElement2);

      console.log("Objects detected:", det1, det2);

      setLoadingText("Calculating similarity...");

      const simResult = await calculateSimilarity(det1, det2, imageElement1, imageElement2);
      console.log("Result:", simResult);

      setResult(simResult);
    } catch (error) {
      console.error("Analysis Error:", error);
      alert(`Error analyzing images: ${error.message}`);
    } finally {
      setAnalyzing(false);
      setLoadingText("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4"
          >
            PicSimilarity AI
          </motion.h1>
          <p className="text-slate-400 text-lg">Compare two images based on objects and colors.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <ImageUploader
            label="Image 1"
            image={img1}
            onImageSelect={(url) => { setImg1(url); setResult(null); }}
            onRemove={() => { setImg1(null); setResult(null); }}
          />
          <ImageUploader
            label="Image 2"
            image={img2}
            onImageSelect={(url) => { setImg2(url); setResult(null); }}
            onRemove={() => { setImg2(null); setResult(null); }}
            overlays={(result && result.diffCircles) ? result.diffCircles : []}
          />
        </div>

        <div className="flex flex-col items-center justify-center mb-12">
          {!modelReady ? (
            <div className="flex items-center space-x-2 text-blue-300 animate-pulse">
              <span className="loading loading-spinner"></span>
              <span>{loadingText || "Loading AI..."}</span>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAnalyze}
              disabled={!img1 || !img2 || analyzing}
              className={`
                px-8 py-4 rounded-full text-xl font-bold flex items-center space-x-3 shadow-xl transition-all
                ${(!img1 || !img2 || analyzing)
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-blue-500/50 text-white'}
              `}
            >
              {analyzing ? (
                <>
                  <Scan className="animate-spin" /> <span>Running Analysis...</span>
                </>
              ) : (
                <>
                  <Scan /> <span>Compare Images</span>
                </>
              )}
            </motion.button>
          )}
        </div>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card rounded-3xl p-8 max-w-3xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Analysis Complete</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 rounded-3xl border border-slate-700">
                    <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-4">
                      {result.diffCircles ? result.diffCircles.length : 0}
                    </div>
                    <p className="text-xl text-slate-300 font-medium">Differences Detected</p>
                    <p className="text-sm text-slate-500 mt-2">Red circles on Image 2</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-800/50 rounded-3xl border border-slate-700">
                    <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500 mb-4">
                      {result.score ? result.score.toFixed(4) : "0.0000"}
                    </div>
                    <p className="text-xl text-slate-300 font-medium">Final Score <span className="text-slate-500">/ 100</span></p>
                    <p className="text-sm text-slate-500 mt-2">Overall similarity score</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center text-slate-500 text-xs">
                Pixel Difference Analysis
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <InnerApp />
  </ErrorBoundary>
);

export default App;
