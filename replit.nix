
{ pkgs }: {
  deps = [
    pkgs.zip
    pkgs.gh
    pkgs.python311Packages.requests
    pkgs.nodejs-18_x
    pkgs.python3
    pkgs.chromium
    pkgs.xvfb-run
    pkgs.postgresql
    pkgs.nodePackages.npm
  ];
  
  env = {
    CHROME_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
    DISPLAY = ":99";
  };
}
