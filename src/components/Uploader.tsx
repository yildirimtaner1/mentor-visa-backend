import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent, FC } from 'react';
import type { AnalysisResponse } from '../types';
import { uploadDocument } from '../services/api';
import { SEO } from './common/SEO';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff',
  'image/webp',
];

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp';

interface UploaderProps {
  onAnalysisResult: (result: AnalysisResponse) => void;
}

const uploaderSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa Employment Letter Auditor",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CAD"
  },
  "description": "Upload your Express Entry employment letter and check for missing IRCC requirements and NOC code alignment mistakes instantly."
});

export const Uploader: FC<UploaderProps> = ({ onAnalysisResult }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const isValidFile = (file: File): boolean => {
    if (ACCEPTED_TYPES.includes(file.type)) return true;
    // Fallback: check extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp'].includes(ext || '');
  };

  const processFile = async (file: File) => {
    if (!file || !isValidFile(file)) {
      setError('Please upload a valid document (PDF, Word, or Image).');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await uploadDocument(file);
      onAnalysisResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during analysis. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div>
      <SEO 
        title="Audit Express Entry Employment Letter | IRCC Checklist Checker" 
        description="Upload your employment reference letter to check for missing IRCC requirements. Identify missing job duties, incorrect formatting, and NOC mismatch risks instantly."
        canonical="/audit-employment-letter"
        schema={uploaderSchema}
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📄 AI-Powered Auditor</div>
          <h1>Audit Your<br /><span className="hero-highlight">Employment Letter</span></h1>
          <p>Drop your document below. Our AI will instantly audit it against all 9 mandatory IRCC requirements and 516 NOC codes.</p>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="uploader-card" style={{ marginBottom: 0 }}>
              <div 
                className={`drop-zone ${isDragging ? 'active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
              >
                <div className="drop-zone-icon">📄</div>
                {loading ? (
                  <div>
                    <div className="loading-spinner"></div>
                    <p style={{ fontWeight: 500 }}>Detecting NOC code & auditing against IRCC standards...</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>The AI is reading your document and the NOC 2021 guide. This may take ~15 seconds.</p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px' }}>Drag & Drop Your Document</p>
                    <p style={{ color: 'var(--text-muted)' }}>or click to browse</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
                      Accepted formats: PDF, Word (.docx), and Images (JPG, PNG)
                    </p>
                    <p style={{ color: 'var(--primary-light)', fontSize: '13px', marginTop: '12px', fontWeight: 500 }}>
                      🤖 NOC code will be detected automatically
                    </p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept={ACCEPTED_EXTENSIONS}
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>
              {error && (
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px 16px', 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '8px', 
                  color: '#991b1b', 
                  fontSize: '14px',
                  textAlign: 'left' 
                }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
