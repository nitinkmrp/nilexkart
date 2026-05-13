import Select from 'react-select';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../app/categorySlice';

const customStyles = {
    control: (provided) => ({
        ...provided,
        backgroundColor: "#0f3460",
        color: "white",
        borderRadius: "5px",
        border: "none",
        boxShadow: "none",
        width: "200px",
        height: "40px",
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected ? "#0f3460" : "white",
        color: state.isSelected ? "white" : "#0f3460",
        "&:hover": {
        backgroundColor: "#0f3460",
        color: "white",
        },
    }),
    singleValue: (provided) => ({
        ...provided,
        color: "white",
    }),
};

const FilterSelect = ({setFilterList, products}) => {
    const dispatch = useDispatch();
    const { categories, loading } = useSelector((state) => state.categories);

    useEffect(() => {
        if (categories.length === 0) {
            dispatch(fetchCategories());
        }
    }, [dispatch, categories.length]);

    // Use fetched categories to create options
    const options = categories.map(c => ({ 
        value: c.name, 
        label: c.name.charAt(0).toUpperCase() + c.name.slice(1) 
    }));

    const handleChange = (selectedOption)=> {
        if (!selectedOption || selectedOption.value === "") {
            setFilterList(products);
        } else {
            setFilterList(products.filter(item => item.category === selectedOption.value));
        }
    }
    
    return (
    <Select
    options={options}
    defaultValue={{ value: "", label: "Filter By Category" }}
    styles={customStyles}
    onChange={handleChange}
    isLoading={loading}
    />
    );
};

export default FilterSelect;
