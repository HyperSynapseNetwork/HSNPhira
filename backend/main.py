from app import create_app
from app.config import Config
from app.common import executor_guard
import click

@click.command()
@click.option('--host', default=Config.HOST, help="set host")
@click.option('--port', default=Config.PORT, type=int, help="set port")
@click.option('--debug/--no-debug', default=Config.DEBUG, is_flag=True, help="whether to run in debug mode")
@executor_guard
def main(host, port, debug):
	app = create_app()
	app.run(host=host, port=port, debug=debug)

if __name__ == "__main__":
	main()
