import React from 'react';
import { GroundingMetadata } from '../types';

interface SourceChipsProps {
  metadata?: GroundingMetadata;
}

export const SourceChips: React.FC<SourceChipsProps> = ({ metadata }) => {
  // Check for search entry point (Google's rendered suggestion/search results)
  const searchEntryPointHtml = metadata?.searchEntryPoint?.renderedContent;

  // Check for grounding chunks (specific citations)
  const chunks = metadata?.groundingChunks || [];

  // Filter unique valid web sources
  const validSources = chunks
    .filter(chunk => chunk.web?.uri && chunk.web?.title)
    .map(chunk => chunk.web!)
    .filter((source, index, self) =>
      index === self.findIndex((s) => s.uri === source.uri)
    );

  if (!searchEntryPointHtml && validSources.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-3 border-t border-gray-200/50 space-y-3">
      {/* Search Entry Point (provided by Google) */}
      {searchEntryPointHtml && (
         <div 
           className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100"
           dangerouslySetInnerHTML={{ __html: searchEntryPointHtml }}
         />
      )}

      {/* Explicit Sources List */}
      {validSources.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 font-semibold mb-2 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            参照ソース
          </p>
          <div className="flex flex-wrap gap-2">
            {validSources.map((source, index) => {
              let hostname = '';
              try {
                hostname = new URL(source.uri).hostname;
              } catch (e) { }

              return (
                <a
                  key={index}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center max-w-full px-2.5 py-1.5 rounded-full text-xs bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 hover:border-blue-400 transition-colors duration-200 shadow-sm truncate group"
                  title={source.title}
                >
                  {hostname && (
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${hostname}`} 
                      alt="" 
                      className="w-3 h-3 mr-1.5 opacity-70 group-hover:opacity-100 transition-opacity"
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  )}
                  <span className="truncate max-w-[200px] font-medium">{source.title}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};