import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Login } from "./App";
import { Empty, ErrorBox } from "./components/States";

describe("Login", () => {
  it("renders accessible form fields", () => {
    render(<Login onLogin={() => {}} />);
    expect(screen.getByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
  });
});
describe("States", () => {
  it("empty state shows its message", () => { render(<Empty text="Nothing here yet" />); expect(screen.getByText("Nothing here yet")).toBeTruthy(); });
  it("error box has alert role", () => { render(<ErrorBox message="Boom" />); expect(screen.getByRole("alert").textContent).toContain("Boom"); });
});
