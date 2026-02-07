"""
Route optimization using Google OR-Tools.

Solves the Travelling Salesman Problem (TSP) to find the optimal
visiting sequence for a sales rep's daily store list, minimising
total travel distance and time.
"""

from __future__ import annotations

import logging
import math
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class StoreLocation(BaseModel):
    """A store's geographic location for route planning."""

    store_id: str
    store_name: str = ""
    lat: float
    lng: float
    priority: int = 50
    estimated_visit_minutes: int = 15


class OptimizedRoute(BaseModel):
    """Result of route optimization."""

    rep_id: str
    ordered_stores: list[StoreLocation] = Field(default_factory=list)
    total_distance_km: float = 0.0
    estimated_duration_minutes: float = 0.0
    start_location: StoreLocation | None = None
    optimization_status: str = "optimal"  # optimal, feasible, not_solved
    waypoints: list[dict[str, float]] = Field(default_factory=list)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate the great-circle distance between two points (km)."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


class RouteOptimizer:
    """Optimal route sequencer using Google OR-Tools TSP solver."""

    # Average speed for road travel in Indian urban/semi-urban areas
    AVG_SPEED_KMH = 25.0

    def __init__(
        self,
        db: AsyncSession | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._db = db
        self._settings = settings or get_settings()

    async def optimize(
        self,
        rep_id: str,
        store_ids: list[str],
        start_location: dict[str, float] | None = None,
        company_id: str | None = None,
    ) -> OptimizedRoute:
        """Find the optimal visiting order for a list of stores.

        Args:
            rep_id: The sales rep UUID.
            store_ids: List of store UUIDs to visit.
            start_location: Optional starting point ``{"lat": ..., "lng": ...}``.
            company_id: Company scope.

        Returns:
            ``OptimizedRoute`` with the optimised store sequence.
        """
        if not store_ids:
            return OptimizedRoute(rep_id=rep_id, optimization_status="not_solved")

        # Fetch store locations
        stores = await self._fetch_store_locations(store_ids, company_id)
        if not stores:
            return OptimizedRoute(rep_id=rep_id, optimization_status="not_solved")

        # Build starting point
        start = None
        if start_location:
            start = StoreLocation(
                store_id="start",
                store_name="Starting Location",
                lat=start_location["lat"],
                lng=start_location["lng"],
                priority=0,
                estimated_visit_minutes=0,
            )

        # If only 1-2 stores, no need for optimization
        if len(stores) <= 2:
            total_dist = 0.0
            ordered = list(stores)
            if start:
                total_dist += _haversine_km(start.lat, start.lng, ordered[0].lat, ordered[0].lng)
            if len(ordered) == 2:
                total_dist += _haversine_km(
                    ordered[0].lat, ordered[0].lng,
                    ordered[1].lat, ordered[1].lng,
                )
            visit_time = sum(s.estimated_visit_minutes for s in ordered)
            travel_time = (total_dist / self.AVG_SPEED_KMH) * 60

            return OptimizedRoute(
                rep_id=rep_id,
                ordered_stores=ordered,
                total_distance_km=round(total_dist, 2),
                estimated_duration_minutes=round(visit_time + travel_time, 0),
                start_location=start,
                optimization_status="optimal",
            )

        # Build nodes: start location (index 0) + stores
        nodes: list[StoreLocation] = []
        if start:
            nodes.append(start)
        else:
            # Use the first store as the starting point
            nodes.append(stores[0])

        for s in stores:
            if start or s != stores[0]:
                nodes.append(s)

        # If there is no real start and we used stores[0], add stores[0] to non-depot nodes
        if not start:
            nodes = stores  # All stores, first one is depot

        # Build distance matrix
        n = len(nodes)
        distance_matrix = self._build_distance_matrix(nodes)

        # Solve TSP using OR-Tools
        try:
            route_indices = self._solve_tsp(distance_matrix, depot=0)
        except Exception:
            logger.warning("OR-Tools TSP solver failed, using nearest-neighbour heuristic.")
            route_indices = self._nearest_neighbour(distance_matrix, depot=0)

        # Build result
        ordered_stores: list[StoreLocation] = []
        total_dist = 0.0
        waypoints: list[dict[str, float]] = []

        for i in range(len(route_indices) - 1):
            from_idx = route_indices[i]
            to_idx = route_indices[i + 1]
            total_dist += distance_matrix[from_idx][to_idx]

        for idx in route_indices:
            node = nodes[idx]
            # Skip the start depot if it's not a real store
            if start and idx == 0:
                continue
            ordered_stores.append(node)
            waypoints.append({"lat": node.lat, "lng": node.lng})

        visit_time = sum(s.estimated_visit_minutes for s in ordered_stores)
        travel_time = (total_dist / self.AVG_SPEED_KMH) * 60

        return OptimizedRoute(
            rep_id=rep_id,
            ordered_stores=ordered_stores,
            total_distance_km=round(total_dist, 2),
            estimated_duration_minutes=round(visit_time + travel_time, 0),
            start_location=start,
            optimization_status="optimal",
            waypoints=waypoints,
        )

    def _build_distance_matrix(
        self, nodes: list[StoreLocation]
    ) -> list[list[float]]:
        """Compute pairwise Haversine distances (km) between all nodes."""
        n = len(nodes)
        matrix: list[list[float]] = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(i + 1, n):
                dist = _haversine_km(
                    nodes[i].lat, nodes[i].lng,
                    nodes[j].lat, nodes[j].lng,
                )
                matrix[i][j] = dist
                matrix[j][i] = dist
        return matrix

    def _solve_tsp(
        self, distance_matrix: list[list[float]], depot: int = 0
    ) -> list[int]:
        """Solve TSP using Google OR-Tools routing solver."""
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2

        n = len(distance_matrix)

        # Scale to integers (metres) for OR-Tools
        INT_SCALE = 1000
        int_matrix = [
            [int(d * INT_SCALE) for d in row] for row in distance_matrix
        ]

        manager = pywrapcp.RoutingIndexManager(n, 1, depot)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Search parameters
        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_params.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_params.time_limit.FromSeconds(5)

        solution = routing.SolveWithParameters(search_params)

        if solution is None:
            raise RuntimeError("OR-Tools could not find a solution.")

        # Extract route
        route: list[int] = []
        index = routing.Start(0)
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            route.append(node)
            index = solution.Value(routing.NextVar(index))
        # Add final node
        route.append(manager.IndexToNode(index))

        return route

    def _nearest_neighbour(
        self, distance_matrix: list[list[float]], depot: int = 0
    ) -> list[int]:
        """Greedy nearest-neighbour heuristic fallback for TSP."""
        n = len(distance_matrix)
        visited = {depot}
        route = [depot]
        current = depot

        while len(visited) < n:
            nearest = -1
            nearest_dist = float("inf")
            for j in range(n):
                if j not in visited and distance_matrix[current][j] < nearest_dist:
                    nearest = j
                    nearest_dist = distance_matrix[current][j]
            if nearest == -1:
                break
            route.append(nearest)
            visited.add(nearest)
            current = nearest

        return route

    async def _fetch_store_locations(
        self, store_ids: list[str], company_id: str | None = None
    ) -> list[StoreLocation]:
        """Fetch lat/lng for stores from the database."""
        if self._db is None or not store_ids:
            return []

        # Build parameterised IN clause
        placeholders = ", ".join(f":sid_{i}" for i in range(len(store_ids)))
        params: dict[str, Any] = {
            f"sid_{i}": sid for i, sid in enumerate(store_ids)
        }

        company_filter = ""
        if company_id:
            company_filter = "AND company_id = :company_id"
            params["company_id"] = company_id

        query = text(f"""
            SELECT id, name, lat, lng
            FROM stores
            WHERE id IN ({placeholders})
              {company_filter}
              AND deleted_at IS NULL
              AND lat IS NOT NULL
              AND lng IS NOT NULL
        """)

        result = await self._db.execute(query, params)
        rows = result.mappings().all()

        stores: list[StoreLocation] = []
        for row in rows:
            stores.append(
                StoreLocation(
                    store_id=str(row["id"]),
                    store_name=str(row["name"]),
                    lat=float(row["lat"]),
                    lng=float(row["lng"]),
                )
            )
        return stores
