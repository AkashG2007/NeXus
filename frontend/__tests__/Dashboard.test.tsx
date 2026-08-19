import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../src/components/Dashboard';
import { vi } from 'vitest';

// Mock the child components to simplify testing the Dashboard layout
vi.mock('../src/components/MetricsCharts', () => ({
  default: () => <div data-testid="metrics-charts-mock">Charts Mock</div>
}));

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: () => {
    const MockMap = () => <div data-testid="city-map-mock">Map Mock</div>;
    return MockMap;
  }
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Clear fetch mocks if any
    vi.clearAllMocks();
    global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) })) as any;
  });

  it('renders the TRINETRA OS header', () => {
    render(<Dashboard />);
    expect(screen.getByText(/TRINETRA OS/i)).toBeInTheDocument();
    expect(screen.getByText(/Tactical Digital Twin/i)).toBeInTheDocument();
  });

  it('renders all the requested navigation tabs', () => {
    render(<Dashboard />);
    expect(screen.getByText('MAP')).toBeInTheDocument();
    expect(screen.getByText('ECO-ZONES')).toBeInTheDocument();
    expect(screen.getByText('FLEET TELEMETRY')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE DISRUPTIONS')).toBeInTheDocument();
    expect(screen.getByText('AQI SENSORS')).toBeInTheDocument();
  });

  it('renders the Tactical Overrides panel', () => {
    render(<Dashboard />);
    expect(screen.getByText(/TACTICAL OVERRIDES/i)).toBeInTheDocument();
    expect(screen.getByText(/CAV PENETRATION/i)).toBeInTheDocument();
    expect(screen.getByText(/SPEED LIMIT OVERRIDE/i)).toBeInTheDocument();
  });

  it('renders the Action buttons correctly', () => {
    render(<Dashboard />);
    expect(screen.getByText('TRIGGER PHANTOM JAM')).toBeInTheDocument();
    expect(screen.getByText('MITIGATE SHOCKWAVE')).toBeInTheDocument();
  });

  it('renders the City-Wide Index panel', () => {
    render(<Dashboard />);
    expect(screen.getByText('TOTAL CO2 AVOIDED')).toBeInTheDocument();
    expect(screen.getByText('TOTAL FLEET SIZE')).toBeInTheDocument();
    expect(screen.getByText('LAMINAR FLOW PROGRESS')).toBeInTheDocument();
  });

  it('updates the active city when the dropdown changes', () => {
    render(<Dashboard />);
    const select = screen.getByRole('combobox');
    expect(screen.getByText('BLR - ORR')).toBeInTheDocument();
    
    fireEvent.change(select, { target: { value: 'mumbai' } });
    expect(screen.getByText('BOM - WEH')).toBeInTheDocument();
  });
});
