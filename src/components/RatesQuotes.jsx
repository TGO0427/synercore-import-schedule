import React, { useState, useEffect, useCallback } from "react";
import { authUtils } from "../utils/auth";

// Vite-friendly, no process.env usage
// Prefer env, otherwise use '' so requests stay relative and hit the Vite proxy
const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? '';



function RatesQuotes({ showSuccess, showError, loading }) {
  const [activeTab, setActiveTab] = useState("dhl");

  const [quotes, setQuotes] = useState({
    dhl: [],
    dsv: [],
    afrigistics: [],
  });
  const [uploading, setUploading] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [quoteToRename, setQuoteToRename] = useState(null);
  const [newQuoteName, setNewQuoteName] = useState("");
  const [selectedQuotes, setSelectedQuotes] = useState([]);
  const [analyzingQuote, setAnalyzingQuote] = useState(null);
  const [showComparisonReport, setShowComparisonReport] = useState(false);
  const [comparisonReport, setComparisonReport] = useState(null);
  const [showAnalysisView, setShowAnalysisView] = useState(false);

  const forwarders = {
    dhl: {
      name: "DHL",
      brandColor: "#d40511",
      icon: "📦",
    },
    dsv: {
      name: "DSV",
      brandColor: "#003d6b",
      icon: "🚛",
    },
    afrigistics: {
      name: "Afrigistics",
      brandColor: "#1a5f2f",
      icon: "🌍",
    },
  };

  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  // Fetch quotes for all forwarders (parallel)
  const fetchQuotes = useCallback(async () => {
    try {
      const entries = await Promise.all(
        Object.keys(forwarders).map(async (fw) => {
          const res = await fetch(`${API_BASE}/api/quotes/${fw}`, {
            headers: authUtils.getAuthHeader(),
            credentials: 'include'
          });
          if (!res.ok) {
            if (res.status === 404) {
              showError?.(
                `${forwarders[fw].name} endpoint not found at ${API_BASE}/api/quotes/${fw}`
              );
            } else if (res.status === 401) {
              console.warn(`Unauthorized access to ${forwarders[fw].name} quotes - check authentication token`);
            }
            return [fw, []];
          }
          const data = await safeJson(res);
          return [fw, Array.isArray(data) ? data : []];
        })
      );
      setQuotes(Object.fromEntries(entries));
    } catch (err) {
      console.error("Error fetching quotes:", err);
      showError?.("Could not fetch quotes. Check API and VITE_API_URL/REACT_APP_API_URL.");
    }
  }, [showError]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const handleFileUpload = async (event, forwarder) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("documents", file));

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/${forwarder}/upload`,
        {
          method: "POST",
          body: formData,
          headers: authUtils.getAuthHeader(),
          credentials: 'include'
        }
      );

      if (!response.ok) {
        let msg = "Failed to upload files";
        const j = await safeJson(response);
        if (j?.error) msg = j.error;
        throw new Error(msg);
      }

      showSuccess?.(
        `Successfully uploaded ${files.length} file(s) to ${forwarders[forwarder].name}`
      );
      fetchQuotes();
    } catch (error) {
      console.error("Error uploading files:", error);
      showError?.(`Failed to upload files: ${error.message}`);
    } finally {
      setUploading(false);
      event.target.value = ""; // reset file input
    }
  };

  const handleDeleteQuote = async (forwarder, filename) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/${forwarder}/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: authUtils.getAuthHeader(),
          credentials: 'include'
        }
      );

      if (!response.ok) {
        let msg = "Failed to delete file";
        const j = await safeJson(response);
        if (j?.error) msg = j.error;
        throw new Error(msg);
      }

      showSuccess?.(`Successfully deleted ${filename}`);
      fetchQuotes();
    } catch (error) {
      console.error("Error deleting file:", error);
      showError?.(`Failed to delete file: ${error.message}`);
    }
  };

  const handleRenameQuote = async () => {
    if (!quoteToRename || !newQuoteName.trim()) return;

    const cleanName = newQuoteName.trim().replace(/[<>:"/\\|?*]/g, "");
    if (!cleanName) {
      showError?.("Please enter a valid filename");
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/${quoteToRename.forwarder}/${encodeURIComponent(
          quoteToRename.filename
        )}/rename`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authUtils.getAuthHeader()
          },
          body: JSON.stringify({ newName: cleanName }),
          credentials: 'include'
        }
      );

      if (!response.ok) {
        let msg = "Failed to rename file";
        const j = await safeJson(response);
        if (j?.error) msg = j.error;
        throw new Error(msg);
      }

      showSuccess?.(`Successfully renamed to ${cleanName}`);
      setShowRenameDialog(false);
      setQuoteToRename(null);
      setNewQuoteName("");
      fetchQuotes();
    } catch (error) {
      console.error("Error renaming quote:", error);
      showError?.(error.message);
    }
  };

  const openRenameDialog = (forwarder, quote) => {
    setQuoteToRename({ ...quote, forwarder });
    setNewQuoteName(quote.filename);
    setShowRenameDialog(true);
  };

  const handleDownloadQuote = (forwarder, filename) => {
    window.open(
      `${API_BASE}/api/quotes/${forwarder}/${encodeURIComponent(filename)}`,
      "_blank"
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // PDF Analysis
  const handleAnalyzeQuote = async (forwarder, filename) => {
    if (!filename.toLowerCase().endsWith(".pdf")) {
      showError?.("Only PDF files can be analyzed");
      return;
    }

    setAnalyzingQuote(`${forwarder}/${filename}`);

    try {
      const response = await fetch(
        `${API_BASE}/api/quotes/${forwarder}/${encodeURIComponent(
          filename
        )}/analyze`,
        {
          method: "POST",
          headers: authUtils.getAuthHeader(),
          credentials: 'include'
        }
      );

      if (!response.ok) {
        let msg = "Failed to analyze PDF";
        const j = await safeJson(response);
        if (j?.error) msg = j.error;
        throw new Error(msg);
      }

      const result = await safeJson(response);
      const prices = result?.analysis?.prices?.length ?? 0;
      const routes = result?.analysis?.routes?.length ?? 0;

      showSuccess?.(
        `Analysis complete! Found ${prices} prices and ${routes} routes`
      );

      // Optional: setShowAnalysisView(true); store result if you want to show details
    } catch (error) {
      console.error("Error analyzing quote:", error);
      showError?.(`Failed to analyze PDF: ${error.message}`);
    } finally {
      setAnalyzingQuote(null);
    }
  };

  const handleSelectQuote = (forwarder, filename, checked) => {
    const quoteId = `${forwarder}/${filename}`;
    if (checked) {
      setSelectedQuotes((prev) => [...prev, { forwarder, filename, id: quoteId }]);
    } else {
      setSelectedQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    }
  };

  const handleCompareSelected = async () => {
    if (selectedQuotes.length < 2) {
      showError?.("Please select at least 2 quotes to compare");
      return;
    }

    const pdfQuotes = selectedQuotes.filter((q) =>
      q.filename.toLowerCase().endsWith(".pdf")
    );

    if (pdfQuotes.length < 2) {
      showError?.("Please select at least 2 PDF files for comparison");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/quotes/compare`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authUtils.getAuthHeader()
        },
        body: JSON.stringify({ quotes: pdfQuotes }),
        credentials: 'include'
      });

      if (!response.ok) {
        let msg = "Failed to generate comparison";
        const j = await safeJson(response);
        if (j?.error) msg = j.error;
        throw new Error(msg);
      }

      const result = await safeJson(response);
      setComparisonReport(result?.report ?? null);
      setShowComparisonReport(true);
      showSuccess?.(`Comparison complete! Analyzed ${pdfQuotes.length} quotes`);
    } catch (error) {
      console.error("Error comparing quotes:", error);
      showError?.(`Failed to compare quotes: ${error.message}`);
    }
  };

  const clearSelection = () => setSelectedQuotes([]);

  const renderTabContent = (forwarder) => {
    const forwarderQuotes = quotes[forwarder] || [];
    const forwarderInfo = forwarders[forwarder];

    return (
      <div style={{ padding: "2rem" }}>
        {/* Upload Section */}
        <div
          style={{
            backgroundColor: "var(--surface-2)",
            border: "2px dashed #dee2e6",
            borderRadius: "12px",
            padding: "2rem",
            textAlign: "center",
            marginBottom: "2rem",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
            {forwarderInfo.icon}
          </div>
          <h3 style={{ marginBottom: "1rem", color: "var(--text-900)" }}>
            Upload {forwarderInfo.name} Quotes & Rates
          </h3>
          <p style={{ color: "#6c757d", marginBottom: "1.5rem" }}>
            Upload PDF files, Excel spreadsheets, or other documents containing
            quotes and rates
          </p>

          <label
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "var(--accent)",
              color: "white",
              borderRadius: "8px",
              cursor: uploading ? "not-allowed" : "pointer",
              fontWeight: "600",
              transition: "all 0.2s ease",
              opacity: uploading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!uploading)
                e.currentTarget.style.backgroundColor = "var(--accent-600)";
            }}
            onMouseLeave={(e) => {
              if (!uploading)
                e.currentTarget.style.backgroundColor = "var(--accent)";
            }}
          >
            {uploading ? "📤 Uploading..." : "📎 Choose Files"}
            <input
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.doc,.docx,.txt,.csv"
              onChange={(e) => handleFileUpload(e, forwarder)}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>

          <p
            style={{
              fontSize: "0.85rem",
              color: "#6c757d",
              marginTop: "0.5rem",
            }}
          >
            Supported formats: PDF, Excel, Word, Text, CSV
          </p>
        </div>

        {/* Documents List */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h4 style={{ margin: 0, color: "var(--text-900)" }}>
              📋 {forwarderInfo.name} Documents ({forwarderQuotes.length})
            </h4>

            {/* Selection and Analysis Tools */}
            {forwarderQuotes.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {selectedQuotes.length > 0 && (
                  <>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-500)" }}>
                      {selectedQuotes.length} selected
                    </span>
                    <button
                      onClick={clearSelection}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleCompareSelected}
                      disabled={selectedQuotes.length < 2}
                      style={{
                        padding: "6px 12px",
                        backgroundColor:
                          selectedQuotes.length >= 2 ? "var(--success)" : "#6c757d",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                        cursor: selectedQuotes.length >= 2 ? "pointer" : "not-allowed",
                      }}
                    >
                      📊 Compare Selected
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {forwarderQuotes.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#6c757d",
                backgroundColor: "var(--surface-2)",
                borderRadius: "8px",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📄</div>
              <p>No documents uploaded yet</p>
              <p style={{ fontSize: "0.9rem" }}>
                Upload your first quote or rate document above
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {forwarderQuotes.map((quote, index) => {
                const isPDF = (quote.filename || "").toLowerCase().endsWith(".pdf");
                const id = `${forwarder}/${quote.filename}`;
                const isSelected = selectedQuotes.some((q) => q.id === id);
                const isAnalyzing = analyzingQuote === id;

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1rem",
                      backgroundColor: isSelected ? "var(--surface-2)" : "white",
                      border: `1px solid ${
                        isSelected ? "var(--accent)" : "var(--border)"
                      }`,
                      borderRadius: "8px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                      if (!isSelected)
                        e.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                      if (!isSelected)
                        e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        flex: 1,
                      }}
                    >
                      {/* Selection Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          handleSelectQuote(forwarder, quote.filename, e.target.checked)
                        }
                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      />

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <span style={{ fontSize: "1.2rem" }}>
                            {isPDF ? "📄" : "📋"}
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--text-900)" }}>
                            {quote.filename}
                          </span>
                          {isPDF && (
                            <span
                              style={{
                                backgroundColor: "#e3f2fd",
                                color: "#1976d2",
                                padding: "2px 6px",
                                borderRadius: "12px",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                              }}
                            >
                              PDF
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                          <span>{formatFileSize(quote.size)}</span>
                          <span style={{ margin: "0 0.5rem" }}>•</span>
                          <span>Uploaded {formatDate(quote.uploadedAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {isPDF && (
                        <button
                          onClick={() => handleAnalyzeQuote(forwarder, quote.filename)}
                          disabled={isAnalyzing}
                          style={{
                            padding: "8px 12px",
                            backgroundColor: isAnalyzing ? "#6c757d" : "var(--info)",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: isAnalyzing ? "not-allowed" : "pointer",
                            fontSize: "0.85rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            transition: "background-color 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isAnalyzing)
                              e.currentTarget.style.backgroundColor = "#138496";
                          }}
                          onMouseLeave={(e) => {
                            if (!isAnalyzing)
                              e.currentTarget.style.backgroundColor = "var(--info)";
                          }}
                          title="Analyze PDF rates and prices"
                        >
                          {isAnalyzing ? "⏳" : "🔍"}
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadQuote(forwarder, quote.filename)}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "var(--success)",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#218838")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "var(--success)")
                        }
                        title="Download document"
                      >
                        💾
                      </button>

                      <button
                        onClick={() => openRenameDialog(forwarder, quote)}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "var(--warning)",
                          color: "var(--text-900)",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#e0a800")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "var(--warning)")
                        }
                        title="Rename document"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => handleDeleteQuote(forwarder, quote.filename)}
                        style={{
                          padding: "8px 12px",
                          backgroundColor: "var(--danger)",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = "#c82333")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor = "var(--danger)")
                        }
                        title="Delete document"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="brand-strip" />
        {/* Header */}
        <div
          className="page-header"
          style={{
            padding: "2rem 2rem 1rem 2rem",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "white",
          }}
        >
          <h1 style={{ margin: 0, color: "var(--text-900)", fontSize: "2rem" }}>
            💰 Rates & Quotes Management
          </h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#6c757d" }}>
            Upload and manage quotes from freight forwarding partners
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #dee2e6",
            backgroundColor: "var(--surface-2)",
          }}
        >
          {Object.entries(forwarders).map(([key, forwarder]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                padding: "1rem 2rem",
                border: "none",
                backgroundColor: activeTab === key ? "white" : "transparent",
                color: activeTab === key ? "var(--accent)" : "#6c757d",
                borderBottom:
                  activeTab === key
                    ? "3px solid var(--accent)"
                    : "3px solid transparent",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: activeTab === key ? 600 : 400,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== key) {
                  e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.5)";
                  e.currentTarget.style.color = "var(--accent)";
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== key) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#6c757d";
                }
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>{forwarder.icon}</span>
              <span>{forwarder.name}</span>
              <span
                style={{
                  backgroundColor: activeTab === key ? "var(--accent)" : "#6c757d",
                  color: "white",
                  borderRadius: "12px",
                  padding: "2px 8px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  minWidth: "20px",
                  textAlign: "center",
                }}
              >
                {quotes[key]?.length || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: "auto", backgroundColor: "var(--surface-2)" }}>
          {renderTabContent(activeTab)}
        </div>
      </div>

      {/* Rename Dialog */}
      {showRenameDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "2rem",
              minWidth: "400px",
              maxWidth: "500px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
              }}
            >
              <h3 style={{ margin: 0, color: "var(--text-900)" }}>Rename Quote Document</h3>
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setQuoteToRename(null);
                  setNewQuoteName("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--text-500)",
                  padding: "0.25rem",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "var(--text-900)",
                }}
              >
                New filename:
              </label>
              <input
                type="text"
                value={newQuoteName}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[<>:"/\\|?*]/g, "");
                  setNewQuoteName(cleaned);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameQuote();
                  } else if (e.key === "Escape") {
                    setShowRenameDialog(false);
                    setQuoteToRename(null);
                    setNewQuoteName("");
                  }
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "2px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
                placeholder="Enter new filename"
                autoFocus
              />
            </div>

            <div
              style={{
                fontSize: "0.8rem",
                color: "#6c757d",
                marginBottom: "1.5rem",
              }}
            >
              Invalid characters (&lt; &gt; : " / \ | ? *) will be automatically
              removed.
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setQuoteToRename(null);
                  setNewQuoteName("");
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#545b62")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#6c757d")
                }
              >
                Cancel
              </button>
              <button
                onClick={handleRenameQuote}
                disabled={!newQuoteName.trim()}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: newQuoteName.trim() ? "var(--success)" : "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: newQuoteName.trim() ? "pointer" : "not-allowed",
                  fontSize: "0.9rem",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (newQuoteName.trim())
                    e.currentTarget.style.backgroundColor = "#218838";
                }}
                onMouseLeave={(e) => {
                  if (newQuoteName.trim())
                    e.currentTarget.style.backgroundColor = "var(--success)";
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Report Modal */}
      {showComparisonReport && comparisonReport && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "2rem",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "2rem",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "2rem",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "1rem",
              }}
            >
              <h2 style={{ margin: 0, color: "var(--text-900)" }}>📊 Quote Comparison Report</h2>
              <button
                onClick={() => setShowComparisonReport(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "var(--text-500)",
                  padding: "0.25rem",
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Report Summary */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ color: "var(--text-900)", marginBottom: "1rem" }}>Summary</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                <div style={{ padding: "1rem", backgroundColor: "var(--surface-2)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--success)" }}>
                    {comparisonReport.summary.totalQuotes}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-500)" }}>Quotes Analyzed</div>
                </div>
                <div style={{ padding: "1rem", backgroundColor: "var(--surface-2)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--info)" }}>
                    {comparisonReport.summary.totalPricesFound}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-500)" }}>Prices Found</div>
                </div>
                <div style={{ padding: "1rem", backgroundColor: "var(--surface-2)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--warning)" }}>
                    {comparisonReport.summary.averageConfidence}%
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-500)" }}>Avg Confidence</div>
                </div>
              </div>
            </div>

            {/* Best Prices */}
            {comparisonReport.bestPrices?.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "var(--text-900)", marginBottom: "1rem" }}>💰 Best Prices</h3>
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {comparisonReport.bestPrices.slice(0, 5).map((price, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.75rem",
                        backgroundColor: index === 0 ? "#d4edda" : "var(--surface-2)",
                        borderRadius: "6px",
                        border: index === 0 ? "1px solid #c3e6cb" : "1px solid #e9ecef",
                      }}
                    >
                      <span style={{ fontWeight: index === 0 ? 600 : 400 }}>
                        {index === 0 && "🏆 "}
                        {price.filename}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: index === 0 ? "#155724" : "var(--text-900)",
                        }}
                      >
                        {price.formatted}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {comparisonReport.recommendations?.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "var(--text-900)", marginBottom: "1rem" }}>💡 Recommendations</h3>
                <div style={{ display: "grid", gap: "1rem" }}>
                  {comparisonReport.recommendations.map((rec, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "1rem",
                        backgroundColor: rec.priority === "high" ? "#fff3cd" : "#d1ecf1",
                        borderRadius: "8px",
                        border: `1px solid ${
                          rec.priority === "high" ? "#ffeaa7" : "#bee5eb"
                        }`,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                        {rec.priority === "high" ? "⚠️" : "ℹ️"} {rec.title}
                      </div>
                      <div style={{ fontSize: "0.9rem", marginBottom: "0.5rem", color: "var(--text-500)" }}>
                        {rec.description}
                      </div>
                      <div style={{ fontSize: "0.85rem", fontStyle: "italic", color: "#444" }}>
                        Action: {rec.action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quote Details */}
            <div>
              <h3 style={{ color: "var(--text-900)", marginBottom: "1rem" }}>📋 Quote Details</h3>
              <div style={{ display: "grid", gap: "1rem" }}>
                {comparisonReport.quotes.map((quote, index) => (
                  <div
                    key={index}
                    style={{
                      padding: "1rem",
                      backgroundColor: "white",
                      border: "1px solid #e9ecef",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{quote.filename}</span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          backgroundColor:
                            quote.confidence >= 70
                              ? "#d4edda"
                              : quote.confidence >= 50
                              ? "#fff3cd"
                              : "#f8d7da",
                          color:
                            quote.confidence >= 70
                              ? "#155724"
                              : quote.confidence >= 50
                              ? "#856404"
                              : "#721c24",
                        }}
                      >
                        {quote.confidence}% confidence
                      </span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "var(--text-500)" }}>
                      Found {quote.summary.priceCount} prices, {quote.summary.routeCount} routes,{" "}
                      {quote.summary.serviceCount} services
                    </div>
                    {quote.summary.lowestPrice && (
                      <div style={{ fontSize: "0.9rem", color: "var(--success)", marginTop: "0.25rem" }}>
                        Lowest price: {quote.summary.lowestPrice.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "2rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                onClick={() => setShowComparisonReport(false)}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "var(--success)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default RatesQuotes;
