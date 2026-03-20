import { forwardRef } from "react";

const DateInput = forwardRef(function DateInput({ value, onClick }, ref) {
  return (
    <input
      className="input"
      ref={ref}
      value={value || ""}
      onClick={onClick}
      readOnly
      aria-label="Choose date"
    />
  );
});

export default DateInput;

