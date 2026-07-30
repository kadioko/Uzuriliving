import clsx from "clsx";

interface LogoMarkProps {
  className?: string;
  imgClassName?: string;
}

export default function LogoMark({ className, imgClassName }: LogoMarkProps) {
  return (
    <span className={clsx("inline-flex items-center justify-center overflow-hidden", className)}>
      <img
        src="/logo/uzuriliving-logo.svg"
        alt="Uzuri Living"
        className={clsx("block h-full w-full", imgClassName)}
      />
    </span>
  );
}
