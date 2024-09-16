import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { X, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import {
  setSelectedLanguage,
  setSelectedMovie,
  setSrtContent,
  setSrtContentAndSave,
} from "@/store/movieSlice";
import { useNavigate } from "react-router-dom";

const SubtitleUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          await dispatch(setSrtContentAndSave(content));
          dispatch(setSelectedMovie(null));
          dispatch(setSelectedLanguage(null));
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

  const handleClear = () => {
    setFile(null);
    dispatch(setSrtContent(null));
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm">
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-muted-foreground bg-accent/20"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
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
  );
};

export default SubtitleUpload;
