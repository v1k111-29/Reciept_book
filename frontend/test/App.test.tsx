import { render, screen } from "@testing-library/react";
import { App } from "../src/App";

test("renders the app title", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "S14 Receipt Book" })).toBeInTheDocument();
});
