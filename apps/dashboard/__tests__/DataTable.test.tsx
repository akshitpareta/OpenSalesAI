import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DataTable, type Column } from '../src/components/DataTable';

// ── Test Data ────────────────────────────────────────────────────────────────

interface TestRow extends Record<string, unknown> {
  id: string;
  name: string;
  city: string;
  revenue: number;
}

const sampleData: TestRow[] = [
  { id: '1', name: 'Sharma General Store', city: 'Mumbai', revenue: 45000 },
  { id: '2', name: 'Patel Kirana', city: 'Ahmedabad', revenue: 32000 },
  { id: '3', name: 'Singh Enterprises', city: 'Delhi', revenue: 67000 },
  { id: '4', name: 'Reddy Supermart', city: 'Hyderabad', revenue: 51000 },
  { id: '5', name: 'Das Corner Shop', city: 'Kolkata', revenue: 28000 },
  { id: '6', name: 'Kumar General', city: 'Chennai', revenue: 39000 },
  { id: '7', name: 'Jain Traders', city: 'Jaipur', revenue: 22000 },
  { id: '8', name: 'Mishra Store', city: 'Lucknow', revenue: 18000 },
  { id: '9', name: 'Gupta Agencies', city: 'Pune', revenue: 55000 },
  { id: '10', name: 'Verma Shop', city: 'Chandigarh', revenue: 42000 },
  { id: '11', name: 'Nair Mart', city: 'Kochi', revenue: 36000 },
  { id: '12', name: 'Roy Brothers', city: 'Bhubaneswar', revenue: 29000 },
];

const columns: Column<TestRow>[] = [
  { key: 'name', header: 'Store Name', sortable: true },
  { key: 'city', header: 'City', sortable: true },
  {
    key: 'revenue',
    header: 'Revenue',
    sortable: true,
    render: (row) => `Rs.${row.revenue.toLocaleString()}`,
  },
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DataTable', () => {
  describe('Rendering', () => {
    it('should render column headers', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
        />,
      );

      expect(screen.getByText('Store Name')).toBeInTheDocument();
      expect(screen.getByText('City')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    it('should render data rows', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData.slice(0, 3)}
          keyExtractor={(row) => row.id}
          pageSize={10}
        />,
      );

      expect(screen.getByText('Sharma General Store')).toBeInTheDocument();
      expect(screen.getByText('Patel Kirana')).toBeInTheDocument();
      expect(screen.getByText('Singh Enterprises')).toBeInTheDocument();
    });

    it('should show custom render output', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData.slice(0, 1)}
          keyExtractor={(row) => row.id}
          pageSize={10}
        />,
      );

      expect(screen.getByText('Rs.45,000')).toBeInTheDocument();
    });

    it('should show empty message when data is empty', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(row) => row.id}
          emptyMessage="No stores found"
        />,
      );

      expect(screen.getByText('No stores found')).toBeInTheDocument();
    });

    it('should show default empty message', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(row) => row.id}
        />,
      );

      expect(screen.getByText('No data found')).toBeInTheDocument();
    });

    it('should show loading skeletons when loading', () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={[]}
          keyExtractor={(row) => row.id}
          loading={true}
        />,
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    it('should paginate data based on pageSize', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          pageSize={5}
        />,
      );

      // Should show first 5 rows
      expect(screen.getByText('Sharma General Store')).toBeInTheDocument();
      expect(screen.getByText('Das Corner Shop')).toBeInTheDocument();

      // Should NOT show 6th row
      expect(screen.queryByText('Kumar General')).not.toBeInTheDocument();
    });

    it('should show pagination info', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          pageSize={5}
        />,
      );

      expect(screen.getByText(/Showing 1 to 5 of 12 results/)).toBeInTheDocument();
    });

    it('should navigate to next page', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          pageSize={5}
        />,
      );

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      // Should show page 2 items
      expect(screen.getByText('Kumar General')).toBeInTheDocument();
      expect(screen.getByText(/Showing 6 to 10/)).toBeInTheDocument();
    });

    it('should navigate back to previous page', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          pageSize={5}
        />,
      );

      // Go to page 2
      fireEvent.click(screen.getByText('Next'));
      // Go back to page 1
      fireEvent.click(screen.getByText('Previous'));

      expect(screen.getByText('Sharma General Store')).toBeInTheDocument();
    });

    it('should disable Previous on first page', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          pageSize={5}
        />,
      );

      const prevButton = screen.getByText('Previous');
      expect(prevButton).toBeDisabled();
    });

    it('should not show pagination when all data fits on one page', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData.slice(0, 3)}
          keyExtractor={(row) => row.id}
          pageSize={10}
        />,
      );

      expect(screen.queryByText('Next')).not.toBeInTheDocument();
      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort ascending on first click', () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={sampleData.slice(0, 5)}
          keyExtractor={(row) => row.id}
          pageSize={10}
        />,
      );

      // Click "Store Name" header to sort ascending
      fireEvent.click(screen.getByText('Store Name'));

      const rows = container.querySelectorAll('tbody tr');
      const firstCellText = rows[0]?.querySelector('td')?.textContent;
      // After ascending sort by name, "Das Corner Shop" should come first
      expect(firstCellText).toBe('Das Corner Shop');
    });

    it('should sort descending on second click', () => {
      const { container } = render(
        <DataTable
          columns={columns}
          data={sampleData.slice(0, 5)}
          keyExtractor={(row) => row.id}
          pageSize={10}
        />,
      );

      // Click twice for descending
      fireEvent.click(screen.getByText('Store Name'));
      fireEvent.click(screen.getByText('Store Name'));

      const rows = container.querySelectorAll('tbody tr');
      const firstCellText = rows[0]?.querySelector('td')?.textContent;
      // After descending sort, "Singh Enterprises" should be first
      expect(firstCellText).toBe('Singh Enterprises');
    });
  });

  describe('Search', () => {
    it('should render search input when searchable is true', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          searchable={true}
          searchPlaceholder="Search stores..."
          pageSize={20}
        />,
      );

      expect(screen.getByPlaceholderText('Search stores...')).toBeInTheDocument();
    });

    it('should filter rows based on search text', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          searchable={true}
          pageSize={20}
        />,
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'Mumbai' } });

      expect(screen.getByText('Sharma General Store')).toBeInTheDocument();
      expect(screen.queryByText('Patel Kirana')).not.toBeInTheDocument();
    });

    it('should show empty message when search matches nothing', () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          keyExtractor={(row) => row.id}
          searchable={true}
          pageSize={20}
        />,
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } });

      expect(screen.getByText('No data found')).toBeInTheDocument();
    });
  });

  describe('Row Click', () => {
    it('should call onRowClick when a row is clicked', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          columns={columns}
          data={sampleData.slice(0, 3)}
          keyExtractor={(row) => row.id}
          onRowClick={onRowClick}
          pageSize={10}
        />,
      );

      fireEvent.click(screen.getByText('Sharma General Store'));
      expect(onRowClick).toHaveBeenCalledTimes(1);
      expect(onRowClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', name: 'Sharma General Store' }),
      );
    });
  });
});
