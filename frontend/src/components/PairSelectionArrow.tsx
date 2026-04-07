/** Decorative mascot + arrow between the two dish cards; rotation follows selection. */
import huskyImg from "../assets/Husky-PNG-Photo.png";
import arrowImg from "../assets/arrow.png";

type PairSelectionArrowProps = {
  selectedIndex: 0 | 1 | null;
};

export function PairSelectionArrow({ selectedIndex }: PairSelectionArrowProps) {
  const arrowRotationClass =
    selectedIndex === null
      ? "-rotate-90"
      : selectedIndex === 0
        ? "-rotate-90 md:rotate-180"
        : "rotate-90 md:rotate-0";

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center py-2 md:min-w-[6rem] md:self-stretch md:py-0 lg:min-w-[7rem]"
      aria-hidden
    >
      <div className="relative flex flex-col items-center">
        <img
          src={huskyImg}
          alt=""
          draggable={false}
          className="relative z-10 h-28 w-28 select-none object-contain sm:h-36 sm:w-36 md:h-[10.5rem] md:w-[10.5rem]"
        />
        <img
          src={arrowImg}
          alt=""
          draggable={false}
          className={[
            "relative z-0 -mt-0 h-24 w-24 origin-center select-none object-contain transition-transform duration-300 ease-out",
            arrowRotationClass,
          ].join(" ")}
        />
      </div>
    </div>
  );
}
