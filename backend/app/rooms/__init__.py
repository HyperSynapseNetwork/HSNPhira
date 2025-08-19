from dataclasses import dataclass, field
from enum import Enum
from json.encoder import JSONEncoder
from flask.json.provider import DefaultJSONProvider
from functools import wraps

@dataclass
class PlayerRecord:
	id: int
	player: int
	score: int
	perfect: int
	good: int
	bad: int
	miss: int
	max_combo: int
	accuracy: float
	full_combo: int
	std: float
	std_score: int


@dataclass
class RoundData:
	chart: int
	records: list[PlayerRecord] = field(default_factory=list)


@dataclass
class RoomData:
	class State(Enum):
		SELECTING_CHART = 0
		WAITING_FOR_READY = 1
		PLAYING = 2

	host: int
	users: set[int]
	lock: bool = False
	cycle: bool = True
	chart: int = None
	state: State = State.SELECTING_CHART
	playing_users: set[int] = field(default_factory=set)
	rounds: list[RoundData] = field(default_factory=list)


# hack json serializing
def _hack_default(old_default):
	@wraps(old_default)
	def new_default(self, obj):
		if isinstance(obj, set):
			return list(obj)
		elif isinstance(obj, Enum):
			return obj.name
		return old_default(obj)
	return new_default

DefaultJSONProvider.default = _hack_default(DefaultJSONProvider.default)
JSONEncoder.default = _hack_default(JSONEncoder.default)
