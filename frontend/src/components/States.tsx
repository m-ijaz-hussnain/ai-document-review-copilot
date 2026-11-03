import React from "react";
export const Loading = () => <p role="status" className="loading">Loading…</p>;
export const Empty = ({ text }: { text: string }) => <p className="empty">{text}</p>;
export const ErrorBox = ({ message }: { message: string }) => <div role="alert" className="error-box">{message}</div>;
export const Badge = ({ value }: { value: string }) => <span className={`badge sev-${value}`}>{value}</span>;
