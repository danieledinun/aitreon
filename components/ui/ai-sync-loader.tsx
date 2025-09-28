"use client";
import React, { useState } from "react";
import { MultiStepLoader as Loader } from "./multi-step-loader";
import { IconSquareRoundedX } from "@tabler/icons-react";

const aiSyncLoadingStates = [
  {
    text: "🧠 Initializing AI Neural Networks...",
  },
  {
    text: "🎥 Discovering YouTube Content Universe...",
  },
  {
    text: "📝 Extracting Voice & Personality Patterns...",
  },
  {
    text: "🧬 Sequencing Creator DNA...",
  },
  {
    text: "💭 Building Memory Engrams...",
  },
  {
    text: "🔮 Training Conversational Synapses...",
  },
  {
    text: "⚡ Charging Neural Pathways...",
  },
  {
    text: "🎯 Calibrating Response Algorithms...",
  },
  {
    text: "🌟 Awakening Your AI Replica...",
  },
  {
    text: "✨ Your Digital Clone is Ready!",
  },
];

const knowledgeProcessingStates = [
  {
    text: "🔍 Scanning Video Library...",
  },
  {
    text: "🎙️ Extracting Audio Transcripts...",
  },
  {
    text: "🧠 Processing Knowledge Chunks...",
  },
  {
    text: "📊 Building Vector Embeddings...",
  },
  {
    text: "🕸️ Organizing Content Structure...",
  },
  {
    text: "⚡ Optimizing Search Indexes...",
  },
  {
    text: "💾 Storing in AI Memory Bank...",
  },
  {
    text: "🎯 Optimizing Retrieval Patterns...",
  },
  {
    text: "✅ Knowledge Base Synchronized!",
  },
];

export function AISyncLoader({ 
  loading, 
  onClose,
  type = 'full' // 'full' for complete setup, 'knowledge' for just content sync
}: { 
  loading: boolean; 
  onClose?: () => void;
  type?: 'full' | 'knowledge';
}) {
  const loadingStates = type === 'full' ? aiSyncLoadingStates : knowledgeProcessingStates;

  return (
    <div>
      {/* Core Loader Modal */}
      <Loader 
        loadingStates={loadingStates} 
        loading={loading} 
        duration={2500}
        loop={false}
      />

      {loading && onClose && (
        <button
          className="fixed top-4 right-4 text-black dark:text-white z-[120] hover:opacity-70 transition-opacity"
          onClick={onClose}
        >
          <IconSquareRoundedX className="h-10 w-10" />
        </button>
      )}
    </div>
  );
}