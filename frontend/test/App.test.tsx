
import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/App";

test("renders the app title and bank desk by default", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "S14 Receipt Book" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Bank desk" })).toBeInTheDocument();
});

test("renders only bank-writable milestones on the bank desk", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "DOCS ACKNOWLEDGED" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PAYMENT RECEIVED" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EDPMS MARKED OFF" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "EBRC SELF CERTIFIED" })).not.toBeInTheDocument();
});

test("renders exporter-writable milestones on the exporters' desk", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Exporters' desk" }));
  expect(screen.getByRole("heading", { name: "Exporters' desk" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EBRC SELF CERTIFIED" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "CUSTOMS STATUS OBSERVED" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "EDPMS MARKED OFF" })).not.toBeInTheDocument();
});

test("renders the timeline fixture with events and cause assessment", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  expect(screen.getByRole("heading", { name: "Shipping bill timeline" })).toBeInTheDocument();
  expect(screen.getByText("DOCS ACKNOWLEDGED")).toBeInTheDocument();
  expect(screen.getByText("PAYMENT RECEIVED")).toBeInTheDocument();
  expect(screen.getByText("EXPORTER LINKAGE MISSING")).toBeInTheDocument();
});

test("renders the pilot metrics fixture", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
  expect(screen.getByRole("heading", { name: "Pilot metrics" })).toBeInTheDocument();
  expect(screen.getByText("Records in demo: 12")).toBeInTheDocument();
  expect(screen.getByText("Pending records: 5")).toBeInTheDocument();
});
