class ClientError(RuntimeError):
	def __init__(self, msg: str, code: int = 400) -> None:
		super().__init__(msg)
		self.code = code
