import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import { useDispatch } from "react-redux";
import { setSrtContent } from "@/store/movieSlice";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const SubtitleUpload: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          dispatch(setSrtContent(content));
          navigate("/dubbing");
        };
        reader.readAsText(acceptedFiles[0]);
      }
    },
    [dispatch, navigate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/srt": [".srt"] },
    multiple: false,
  });

  const handleToggle = () => setIsExpanded(!isExpanded);

  const handleClear = () => {
    setFile(null);
    dispatch(setSrtContent(null));
  };

  return (
    <div className="mb-4">
      {!isExpanded ? (
        <Button onClick={handleToggle} variant="outline" className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          {t("uploadSubtitles")}
        </Button>
      ) : (
        <div className="bg-card p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">{t("uploadSubtitles")}</h3>
            <Button onClick={handleToggle} variant="ghost" size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <input {...getInputProps()} />
              <FileText className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? t("dropFileHere") : t("dragAndDropOrClick")}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-accent bg-opacity-10 p-2 rounded">
              <span className="text-sm truncate">{file.name}</span>
              <Button onClick={handleClear} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubtitleUpload;
