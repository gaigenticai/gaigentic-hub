import { useState } from "react";
import { Star, Send, ChevronDown, ChevronUp } from "lucide-react";
import { submitFeedback } from "../services/api";

interface Props {
  auditLogId: string | null;
}

export default function FeedbackWidget({ auditLogId }: Props) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!auditLogId) return null;

  if (submitted) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="text-sm font-medium text-emerald-700">
          Thank you for your feedback! It helps us improve.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    setError("");
    try {
      await submitFeedback(
        auditLogId,
        rating,
        comment || undefined,
        correction || undefined,
      );
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-gray-700">
        How was this response?
      </p>

      {/* Stars */}
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                star <= (hoveredStar || rating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 self-center text-xs text-gray-500">
            {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
          </span>
        )}
      </div>

      {/* Comment */}
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional — what could be better?"
            className="input mb-2 resize-none text-sm"
            rows={2}
          />

          {/* Correction toggle */}
          <button
            onClick={() => setShowCorrection(!showCorrection)}
            className="mb-2 flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
          >
            {showCorrection ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Suggest a correction
          </button>

          {showCorrection && (
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="What should the correct response be? This helps train our agents."
              className="input mb-3 resize-none text-sm"
              rows={3}
            />
          )}

          {error && (
            <p className="mb-2 text-xs text-red-500">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? "Submitting..." : "Submit Feedback"}
          </button>
        </>
      )}
    </div>
  );
}
