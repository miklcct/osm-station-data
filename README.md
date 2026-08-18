# Fetch GB rail station data from OpenStreetMap

This package provides one function, `fetchStationData`, which fetches rail
stations (defined as having an CRS code, so it may contain other rail-ticketable
stations as well) with their platforms and entrances from OpenStreetMap.

In addition, it contains an example which displays the data on the map, which
can be used for quality-assuring OpenStreetMap data. Stations in stop areas are
shown in a big blue dot, naked stations (not in stop areas) are shown in a big
red dot, platform outlines and entrance locations belonging to the stop area
are shown as well.