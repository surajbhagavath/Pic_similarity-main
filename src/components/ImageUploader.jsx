import React, { useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const ImageUploader = ({ label, image, onImageSelect, onRemove, overlays = [] }) => {
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            onImageSelect(url, file);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            onImageSelect(url, file);
        }
    };

    return (
        <div className="flex flex-col items-center w-full">
            <h3 className="text-xl font-bold mb-4 text-blue-200">{label}</h3>

            <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative w-full aspect-square max-w-sm rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden cursor-pointer
          ${image ? 'border-transparent' : 'border-blue-400/30 bg-blue-500/5 hover:bg-blue-500/10'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                {image ? (
                    <>
                        <img
                            id={`img-${label.replace(" ", "")}`}
                            src={image}
                            alt="Uploaded"
                            className="w-full h-full object-cover rounded-2xl relative z-0"
                            crossOrigin="anonymous"
                        />

                        {/* Diff Overlays Layer */}
                        <svg
                            className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
                            viewBox={image ? `0 0 ${document.getElementById(`img-${label.replace(" ", "")}`)?.naturalWidth || 100} ${document.getElementById(`img-${label.replace(" ", "")}`)?.naturalHeight || 100}` : "0 0 100 100"}
                        >
                            {overlays.map((circle, i) => (
                                <circle
                                    key={i}
                                    cx={circle.x}
                                    cy={circle.y}
                                    r={circle.radius}
                                    fill="none"
                                    stroke="red"
                                    strokeWidth="5"
                                    className="animate-pulse drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]"
                                />
                            ))}
                        </svg>

                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full backdrop-blur-sm transition-colors z-20"
                        >
                            <X size={20} />
                        </button>
                    </>
                ) : (
                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                        <Upload size={48} className="text-blue-400 mb-4 opacity-80" />
                        <span className="text-blue-200 font-medium">Click or Drag Image</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </label>
                )}
            </motion.div>
        </div>
    );
};

export default ImageUploader;
